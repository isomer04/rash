# Troubleshooting Log

Real issues hit while building Rash, with root cause and fix. Useful for interview "tell me about a bug you debugged" questions.

---

## Issue: `terraform apply` fails with "no matching EC2 VPC found" (`stacks/database`)

**Where:** `terraform/stacks/database`, running `terraform apply` to deploy the Aurora Serverless v2 cluster.

**Symptom:**
```
Error: no matching EC2 VPC found
  with data.aws_vpc.default,
  on main.tf line 61, in data "aws_vpc" "default":
  61: data "aws_vpc" "default" {
```

**Root cause:**
`terraform/stacks/database/main.tf` uses a data source to look up the AWS account's *default* VPC (`data "aws_vpc" "default" { default = true }`) so it can create a DB subnet group and security group for the Aurora cluster. This account had **zero VPCs** in `us-east-1` — no default VPC existed. Historically AWS auto-provisioned a default VPC in every region for every new account, but that stopped for many newer accounts, so this assumption in the Terraform silently breaks for any account without one. Confirmed via:
```bash
aws ec2 describe-vpcs --query 'Vpcs[*].{VpcId:VpcId,IsDefault:IsDefault}' --output table
# -> empty
```

The database documentation advertised the Aurora setup as "No VPC Complexity" / "no VPC needed" because the Data API removes the need for Lambda to run *inside* the VPC — but the Aurora cluster resource itself still requires a VPC + subnet group to be provisioned into, which was never called out. Nothing in the deployment documentation mentioned creating or verifying a default VPC.

**Why the CLI fix path was blocked too:**
```bash
aws ec2 create-default-vpc
# -> UnauthorizedOperation: aiengineer is not authorized to perform ec2:CreateDefaultVpc
```
The `aiengineer` IAM user (the least-privilege user for this project) has broad but scoped permissions via the `RashAccess`/`TwinAccess` groups — `ec2:CreateDefaultVpc` isn't among them, since it's a rare, account-level, one-time operation, not something a day-to-day IAM user should normally need.

**Fix:**
```bash
aws ec2 create-default-vpc --region us-east-1
```
This provisioned a standard default VPC with a default subnet in each AZ for `us-east-1`. Re-ran `terraform apply` in `terraform/stacks/database` and the `data "aws_vpc" "default"` lookup resolved, so the Aurora cluster, subnet group, and security group created successfully.

Note: the first attempt at this same command failed with `UnauthorizedOperation` under the `aiengineer` IAM user, since `ec2:CreateDefaultVpc` wasn't covered by the `RashAccess`/`TwinAccess` group policies. Once run with sufficient permissions, the CLI one-liner is the fastest fix — no need to go through the console.

**Interview framing:** an infra assumption (default VPC always exists) baked into the Terraform broke for an account that didn't have one; diagnosed via `aws ec2 describe-vpcs` rather than guessing from the Terraform error alone, hit an IAM permission gap on the first fix attempt (`ec2:CreateDefaultVpc` not granted to the least-privilege IAM user), then resolved it with a single scoped AWS CLI command once run with adequate permissions.

---

## Issue: CloudFront serves `404 NoSuchKey: index.html` after a successful `terraform apply` (`stacks/frontend`)

**Where:** `terraform/stacks/frontend`. `terraform apply` reported `Apply complete! Resources: 17 added`, but the CloudFront URL returned an error page.

**Symptom:**
```
404 Not Found
Code: NoSuchKey
Message: The specified key does not exist.
Key: index.html

An Error Occurred While Attempting to Retrieve a Custom Error Document
Code: NoSuchKey
Key: 404.html
```

**Root cause:**
Terraform provisions the *infrastructure* (S3 bucket, CloudFront distribution, API Gateway, Lambda, IAM) but never uploads the site's files. Building and deploying the frontend is a separate step (`scripts/deploy.py`) that hadn't been run yet. So CloudFront was correctly serving from a completely empty bucket. Confirmed with two checks rather than inferring from the browser error:
```bash
ls frontend/out            # -> does not exist; npm run build had never run
aws s3 ls s3://rash-frontend-494191147246/ --recursive   # -> empty
```
The second `NoSuchKey` for `404.html` is a knock-on effect of the same cause: S3's website endpoint tried to serve its custom error document, which was also missing from the empty bucket. Nothing was actually misconfigured in the infrastructure.

**Fix:**
```bash
cd scripts
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run deploy.py
```
`deploy.py` packages the API Lambda, re-runs `terraform apply` (a no-op when infra is current), builds the NextJS static export, uploads to S3 with correct per-type content types and cache headers, and invalidates the CloudFront cache. Result: 45 objects in the bucket, and the CloudFront URL returned `HTTP 200 text/html`.

**Blocker hit along the way — `UnicodeEncodeError` on Windows:**
```
UnicodeEncodeError: 'charmap' codec can't encode character '\U0001f680' in position 0
  File "scripts/deploy.py", line 338, in main
    print("\U0001f680 Rash Financial Advisor - Part 7 Deployment")
```
The script crashed instantly, before doing any work. The repo's Python scripts print emoji in their status output, but Python on Windows defaults its stdout encoding to the legacy `cp1252` codepage, which has no mapping for emoji. Not an AWS or Terraform problem at all. Fixed without editing the script by forcing UTF-8 output via environment variables (`PYTHONUTF8=1 PYTHONIOENCODING=utf-8`). This affects every emoji-printing script in the repo on Windows — `run_local.py`, `destroy.py`, and the `package_docker.py` scripts — so the same prefix applies to all of them.

**Two false leads worth recording (both were wrong):**

1. *"The wrong API URL got baked into the build."* `grep` showed `localhost:8000` in the built JS bundle and no API Gateway URL, which looked like the static export had frozen in the dev API endpoint. It hadn't. The pages import `API_URL` from `lib/config.ts`, which decides at *runtime* by hostname — returning `''` in production so the app calls relative `/api/*` paths that CloudFront routes to API Gateway. The `localhost:8000` string is just that file's dev branch. `lib/api.ts` (which does read `NEXT_PUBLIC_API_URL`) is unused dead code, so that env var is irrelevant to the deployed site.

2. *"CloudFront isn't routing `/api/*` to API Gateway."* `curl https://<cdn>/api/user` returned `index.html` with `Server: AmazonS3`, which looked like the API path was falling through to the S3 origin. It wasn't. The distribution's `ordered_cache_behavior` for `/api/*` was configured correctly; the real cause is the two `custom_error_response` blocks that rewrite **403 and 404 into a 200 serving `/index.html`** across all behaviors — masking the API's legitimate 403 for an unauthenticated request. Proved routing works by sending a method the error pages don't remap:
```bash
curl -i -X POST https://d27voe79zmvxyl.cloudfront.net/api/user
# -> HTTP 405 Method Not Allowed, allow: GET, Apigw-Requestid: ...
```
The `Apigw-Requestid` header and FastAPI's own 405 prove the request reached Lambda through API Gateway. A browser session with a Clerk JWT gets a real response.

**Interview framing:** a green `terraform apply` created a false sense of "deployed" — IaC provisioned the delivery infrastructure but the application artifact was never built or shipped, so the CDN was faithfully serving an empty bucket. Diagnosed by verifying the build output and bucket contents directly instead of trusting the browser error. Also a reminder that CloudFront custom error responses apply across *all* cache behaviors, including API paths, where they silently convert real 4xx API responses into 200s serving HTML — actively misleading when debugging, and worth scoping to the S3 behavior only in a production design.

---

## Issue: Every API call returns `403 "You don't have permission to access this resource."`, then the API stops responding entirely (`stacks/frontend`, local dev)

**Where:** Running the stack locally via `uv run run_local.py` (frontend on `:3000`, FastAPI on `:8000`). Hit on `/dashboard` and `/advisor-team`.

**Symptom (phase 1):** Next.js runtime error, with the failing `fetch` in `pages/dashboard.tsx:129`:
```text
Failed to sync user: 403
```
Response body in the Network tab:
```json
{"detail":"You don't have permission to access this resource."}
```

**Symptom (phase 2):** After some use, *every* request to `localhost:8000` hung as `(pending)` forever — `/api/user`, `/api/accounts`, `/api/jobs`, `/api/analyze`. The "Add New Account" dialog stuck on "Creating…", the analysis panel stuck on "Initializing analysis…". Only `clerk.browser.js` requests returned 200, because those go straight to Clerk and never touch the backend.

**Root cause — actual bug: the system clock was 7.7 seconds slow.**

Clerk stamps each session token's `iat` ("issued at") with the true time. The machine believed it was ~8 seconds earlier, so `iat` appeared to be in the *future*, and PyJWT rejected the token:
```text
jwt.exceptions.ImmatureSignatureError: The token is not yet valid (iat)
```
PyJWT validates `iat` with **zero leeway** by default, so even a one-second drift is fatal. The Clerk keys, JWKS URL, and signature were all correct — verification got all the way past the signature check to claim validation before failing.

The underlying reason the clock drifted: the **Windows Time service (`w32time`) was stopped**, with `StartType: Manual`. Nothing was keeping the clock in sync. Confirmed by measuring against an authoritative `Date` header:
```powershell
$local = (Get-Date).ToUniversalTime()
$server = [DateTime]::Parse((Invoke-WebRequest https://www.google.com -Method Head -UseBasicParsing).Headers['Date']).ToUniversalTime()
($local - $server).TotalSeconds   # -> -7.7   (negative = clock is BEHIND)
```

**Three layers of masking hid that one-line error:**

1. **`fastapi_clerk_auth` swallows the exception.** `_decode_token()` catches *every* exception and returns `None` unless `debug_mode=True` (`fastapi_clerk_auth/__init__.py:146-149`), which then becomes a generic `HTTPException(403, "Invalid Authentication Credentials")`.
2. **`main.py` rewrites the 403.** The custom handler at `backend/api/main.py:71` maps *all* 403s to a friendly string, discarding even the library's generic detail. The browser message was therefore pure noise — it carried zero diagnostic information.
3. **`run_local.py` trapped every log line and deadlocked the server.** This is the phase-2 symptom and a genuine second bug — see below.

**Root cause — second bug: undrained pipe deadlock in `scripts/run_local.py`.**

The backend was spawned with both streams piped and **no reader**:
```python
proc = subprocess.Popen(
    ["uv", "run", "main.py"], cwd=backend_dir,
    stdout=subprocess.PIPE, stderr=subprocess.PIPE,   # never read
    text=True, bufsize=1)
```
`start_frontend()` pipes output too, but spawns a background thread to drain it. `start_backend()` did not. An OS pipe has a fixed buffer; uvicorn writes an access-log line per request. Once the buffer filled with nobody reading, the backend blocked forever inside `write()` — mid-log, holding the asyncio event loop.

This produced a distinctive signature that ruled out every network/database explanation:
```bash
curl -m 10 -o /dev/null -w "%{http_code} connect=%{time_connect}s\n" http://localhost:8000/health
# -> 000 connect=0.215s   (TCP connects instantly, then never responds)
```
`/health` returns a hardcoded dict with no auth and no database access. If *that* hangs, the problem is not Clerk, SQS, or Aurora — the ASGI event loop is not servicing requests. The socket stayed bound (the OS keeps accepting into the backlog) while the process sat at 1.7s total CPU: blocked on I/O, not spinning.

Critically, this is *why* there were no logs to read. Every error, including the `ImmatureSignatureError`, was stuck in that undrained pipe.

**Fix:**

1. Sync the clock and keep it synced (admin PowerShell):
```powershell
Start-Service w32time
w32tm /resync /force
Set-Service w32time -StartupType Automatic   # <- the part that prevents recurrence
```
Verified skew afterwards: `-0.2s`. Then hard-refresh the browser so Clerk mints a fresh token.

2. Drain the backend's output in `scripts/run_local.py`, mirroring the pattern `start_frontend()` already used:
```python
proc = subprocess.Popen(
    ["uv", "run", "main.py"], cwd=backend_dir,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,   # was a second undrained pipe - same trap
    text=True, bufsize=1)

def read_output():
    for line in proc.stdout:
        print(f"    Backend: {line.rstrip()}")

threading.Thread(target=read_output, daemon=True).start()
```

3. Temporarily set `ClerkHTTPBearer(clerk_config, debug_mode=True)` in `backend/api/main.py` to surface the real JWT exception. Revert once resolved.

**Note:** there is no config knob for clock tolerance. `ClerkConfig` exposes `verify_exp`, `verify_aud`, and `verify_iss` but **no `leeway`**, and `_decode_token` calls `jwt.decode()` without one. Fixing the clock is the only clean fix short of subclassing.

**False lead worth recording:** the first hypothesis was a Clerk instance mismatch — the frontend's `pk_test_…` belonging to a different Clerk application than the root `.env` `CLERK_JWKS_URL`, which is a common cause of 403s here (three env files existed under `frontend/`: `.env`, `.env.local`, `.env.production.local`). It was wrong. Reading the library source ruled out a whole class of causes cheaply: `ClerkConfig` defaults to `verify_aud=False` and `verify_iss=False`, so mismatched `iss`/`azp` claims *cannot* cause a 403 here, leaving `verify_exp` as the only active claim check — which pointed straight at time.

**Interview framing:** a one-line root cause (an 8-second clock drift) hidden behind three layers of well-intentioned error handling — a library that swallows exceptions by default, a custom handler that replaces error details with friendly copy, and a dev script that deadlocked the server by piping output nobody read. Diagnosed by *narrowing the blast radius* rather than guessing: curling an unauthenticated, database-free `/health` endpoint proved the failure was upstream of every suspected cloud dependency, and reading the auth library's source ruled out issuer/audience mismatches without trial and error. The lesson is that friendly error messages and broad `except` blocks are diagnostic liabilities — the fix included turning on the library's `debug_mode` and draining the log pipe so the actual exception could surface at all.

---

## Issue: Every deployed API call returns `500 "An internal error occurred"` after a database migration (`stacks/database` → `stacks/frontend`)

**Where:** The live CloudFront site after the `migration/aurora-to-dynamodb` PR (#3) merged to `main`. Dashboard, Accounts, and "Start new analysis" all failed; the analyses panel showed "No previous analyses found".

**Symptom:**
```json
POST https://d27voe79zmvxyl.cloudfront.net/api/analyze -> 500
{"detail":"An internal error occurred. Please try again later."}
```

**Root cause: the deployed Lambda artifacts were stale relative to the infrastructure.**

The migration's `terraform apply` in `stacks/database` **destroyed the Aurora cluster** and created DynamoDB tables. But the six Lambdas had last been deployed on Aug 17-18 and were never repackaged, so every one of them was still running Aurora code against a cluster that no longer existed. CloudWatch gave the exact error immediately:
```text
Database error: An error occurred (HttpEndpointNotEnabledException) when calling the
ExecuteStatement operation: HttpEndpoint is not enabled for resource
arn:aws:rds:us-east-1:494191147246:cluster:rash-aurora-cluster
```
Repeated identically for `get_or_create_user`, `Error listing jobs`, `Error listing accounts`, and `Error triggering analysis` — one message per feature that touches the database, which is every feature.

Two commands confirmed it rather than inferring from the log line alone:
```bash
aws rds describe-db-clusters --db-cluster-identifier rash-aurora-cluster
# -> DBClusterNotFoundFault: DBCluster rash-aurora-cluster not found   (gone entirely)

aws lambda get-function-configuration --function-name rash-api
# -> AURORA_CLUSTER_ARN set, zero DYNAMODB_* vars, LastModified 2026-08-17
```
All five agent Lambdas were in the same state (`LastModified` Aug 18, Aurora-only env vars), so even a fixed API would have handed work to agents that couldn't reach the database either.

**Why this is a structural trap, not carelessness:** each Lambda bundles a *copy* of the shared `backend/database` library into its zip at package time (`pip install --target ./package --no-deps /database`). The data layer is therefore frozen into every artifact when it's built. `terraform apply` in `stacks/database` updates infrastructure but has no idea that six zip files elsewhere now contain code for a database that no longer exists. **The two halves drift independently and nothing warns you.**

**The code was already correct — no fix was needed there.** `terraform/stacks/frontend/main.tf:216` and `terraform/stacks/agents/main.tf:245` already passed `DYNAMODB_*` env vars, `stacks/agents/terraform.tfvars` already listed the table names, and `backend/api/` plus all five agent sources contained **zero** Aurora references. Purely a deployment gap.

**Fix:** repackage and redeploy all six Lambdas. Full command process below — the same sequence is in `DEPLOYMENT.md` under *Appendix: exact command sequence*.

*Step 0 — confirm the diagnosis before changing anything (all read-only):*
```bash
aws lambda get-function-configuration --function-name rash-api \
  --query "{LastModified:LastModified,CodeSize:CodeSize}" --output table   # stale date?
aws rds describe-db-clusters --db-cluster-identifier rash-aurora-cluster   # still exists?
aws dynamodb list-tables --output text                                     # new tables live?
docker info --format "{{.ServerVersion}}"                                  # Docker running?
```
```powershell
# PowerShell - Git Bash mangles /aws/lambda/... into a Windows path
$since = [DateTimeOffset]::UtcNow.AddHours(-2).ToUnixTimeMilliseconds()
aws logs filter-log-events --log-group-name /aws/lambda/rash-api `
  --start-time $since --filter-pattern "?ERROR ?Traceback ?Exception" `
  --max-items 60 --query "events[].message" --output text
```

*Step 1 — package the five agents.* Run the first alone so it pulls `public.ecr.aws/lambda/python:3.12`, then the rest concurrently against the warm cache. Each prints nothing until it exits (buffered stdout) — check `docker ps` rather than assuming a hang:
Each package runs in a subshell so one `cd` cannot leak into the next, and every background job's exit status is checked — a bare `wait` returns 0 even when a child failed, which would let a failed package sail into `terraform apply` and deploy a stale zip:
```bash
PROJ="$(git rev-parse --show-toplevel)"

(cd "$PROJ/backend/planner" && uv run package_docker.py) \
  || { echo "planner FAILED"; exit 1; }      # ~88 MB, slowest — pulls the base image

pids=""
for a in tagger reporter charter retirement; do
  (cd "$PROJ/backend/$a" && uv run package_docker.py) &
  pids="$pids $!:$a"
done

failed=""
for entry in $pids; do
  pid=${entry%%:*}; name=${entry##*:}
  wait "$pid" || failed="$failed $name"
done
[ -n "$failed" ] && { echo "PACKAGING FAILED:$failed — do NOT apply"; exit 1; }
echo "all five packaged OK"
```

*Step 2 — upload the zips and swap the agents' env vars to DynamoDB.* Only run this once the guard above prints `all five packaged OK`:
```bash
(cd "$PROJ/terraform/stacks/agents" && terraform apply -auto-approve) \
  || { echo "agents apply FAILED"; exit 1; }
```

*Step 3 — API Lambda + frontend in one shot:*
```bash
(cd "$PROJ/scripts" && PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run deploy.py)
```
That prefix is a **per-command env var, not a saved setting** — retype it every run. Nothing in the repo sets it; only these docs record it. PowerShell has no inline prefix syntax, so use `$env:PYTHONUTF8 = "1"; $env:PYTHONIOENCODING = "utf-8"; uv run deploy.py`.

*Step 4 — verify each layer separately:*
```bash
CF_URL=$(cd "$PROJ/terraform/stacks/frontend" && terraform output -raw cloudfront_url)
curl -s -i -X GET "$CF_URL/api/analyze" | head -8      # want 405, not 500
(cd "$PROJ/backend/database" && uv run verify_database.py)
```
```powershell
$since = [DateTimeOffset]::UtcNow.AddMinutes(-15).ToUnixTimeMilliseconds()
aws logs filter-log-events --log-group-name /aws/lambda/rash-api `
  --start-time $since --filter-pattern "HttpEndpointNotEnabled" `
  --query "length(events)" --output text        # want 0

foreach ($f in @("rash-api","rash-planner","rash-tagger","rash-reporter","rash-charter","rash-retirement")) {
  $c = aws lambda get-function-configuration --function-name $f `
       --query "{LM:LastModified,Aurora:Environment.Variables.AURORA_CLUSTER_ARN,Users:Environment.Variables.DYNAMODB_USERS_TABLE}" `
       --output json | ConvertFrom-Json
  Write-Output "$f | $($c.LM) | aurora='$($c.Aurora)' | users=$($c.Users)"
}
```

Verified afterwards:
```text
all 6 Lambdas    -> LastModified 2026-08-22T22:12-22:15, aurora='', users=rash-users
HttpEndpointNotEnabled errors -> 0
GET /api/analyze -> 405 Method Not Allowed, Allow: POST, Apigw-Requestid present
verify_database  -> users 3 / instruments 28 / accounts 7 / positions 30 / jobs 26,
                    all ACTIVE, no orphans
```

**Two traps hit while verifying (both previously recorded in this file, both still bite):**

1. *`curl -X POST /api/analyze` returned `200 text/html` from `Server: AmazonS3`* — which looks like the API route is broken. It isn't. CloudFront's `custom_error_response` blocks rewrite **403/404 into 200 serving `/index.html`** across *all* cache behaviors, masking the real response. Send a method the error pages don't remap to get the truth: `curl -i -X GET /api/analyze` -> `405 Method Not Allowed, Allow: POST` with an `Apigw-Requestid` header, proving the request reached Lambda.

2. *`aws logs ... --log-group-name /aws/lambda/rash-api` failed with `InvalidParameterException ... failed to satisfy constraint`* — which reads like an IAM or naming problem. It's Git Bash rewriting the leading `/aws/...` into a Windows path. Run AWS log commands in PowerShell, or prefix with `MSYS_NO_PATHCONV=1`.

**A third false trail, in the tooling:** the five `package_docker.py` runs printed *nothing at all* for many minutes, which reads as a hang. Python buffers stdout when piped; the builds were fine. `docker ps` showing an `Up N minutes` container on `public.ecr.aws/lambda/python:3.12` is the way to confirm real progress without killing a working build.

**Interview framing:** a database migration that was "complete" by every visible signal — PR merged, `terraform apply` green, new tables live with correctly migrated data — took the entire application down, because infrastructure state and deployed artifact state drift independently and only IaC was updated. The shared data-access library is vendored into each Lambda zip at package time, so six separate artifacts silently retained code for a cluster that had been deleted. Diagnosed in minutes by reading CloudWatch first and then *confirming* the hypothesis with `describe-db-clusters` (cluster genuinely absent) and `get-function-configuration` (stale `LastModified`, Aurora-only env vars) rather than editing code; the correct fix contained **zero** code changes. The systemic lesson is that "migrate the database" must be defined as *provision the new store **and** rebuild every artifact that embeds a client for the old one* — and that a passing `terraform apply` is evidence about infrastructure only, never about the code running on it.
