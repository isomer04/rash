# Full-Stack Deployment Runbook

How to deploy Rash end to end, and — more importantly — **when a partial deploy will
silently break production**.

For a frontend-only change, use [`FRONTEND_DEPLOY.md`](FRONTEND_DEPLOY.md) instead.
This document covers the whole stack and the ordering rules between them.

---

## The rule that matters most

> **If you change anything in `terraform/stacks/database` or `backend/database/`, you must
> redeploy all six Lambdas.** Terraform will not do this for you.

The six Lambdas (`rash-api` + the five agents) each bundle a *copy* of the shared
`backend/database` library inside their zip. `package_docker.py` installs it into the
package (`pip install --target ./package --no-deps /database`). So the database layer
is **baked into every Lambda artifact at package time**, not loaded at runtime.

That means a database migration has two halves, and Terraform only does the first:

| Half | What does it | Happens automatically? |
|---|---|---|
| Provision new tables, drop old ones | `terraform apply` in `stacks/database` | ✅ yes |
| Update the code that talks to them | `package_docker.py` per Lambda + apply `stacks/agents`/`stacks/frontend` | ❌ **no** |

Skip the second half and you get infrastructure pointing at a database that no longer
exists. That is exactly what happened on 2026-08-22 — see
[the incident record](#incident-record-2026-08-22) below and the matching entry in
`TROUBLESHOOTING.md`.

---

## What's deployed where

| Component | Terraform dir | Deploy mechanism |
|---|---|---|
| SageMaker embeddings | `stacks/sagemaker` | `terraform apply` |
| S3 Vectors + ingest | `stacks/ingestion` | `terraform apply` |
| Researcher (Lambda + Function URL) | `stacks/researcher` | `terraform apply` + ECR push |
| DynamoDB tables | `stacks/database` | `terraform apply` |
| 5 agent Lambdas | `stacks/agents` | `package_docker.py` ×5, then `terraform apply` |
| API Lambda + S3 + CloudFront | `stacks/frontend` | `scripts/deploy.py` |
| Monitoring | `stacks/observability` | `terraform apply` |

Each Terraform stack has **its own independent state file** in the shared S3 backend. `stacks/frontend`
reads `stacks/database` and `stacks/agents` via `terraform_remote_state` against that same
backend (`stacks/frontend/main.tf:22`), so both must be applied **first** or the table
names won't resolve.

Current deployment targets (re-derive with `terraform output`, never hardcode):

| Thing | Value |
|---|---|
| CloudFront | `https://d27voe79zmvxyl.cloudfront.net` (dist `E1S13FT7Y8LTJS`) |
| S3 bucket | `rash-frontend-494191147246` |
| API Gateway | `https://pln046fmb3.execute-api.us-east-1.amazonaws.com` |
| DynamoDB | `rash-users`, `-accounts`, `-positions`, `-instruments`, `-jobs` |
| Account / region | `494191147246` / `us-east-1` (Bedrock in `us-west-2`) |

---

## Standing the system up from scratch

The rest of this document assumes the platform already exists. To build it on a
fresh AWS account, apply the stacks in the order below.

`stacks/bootstrap` is a separate first-run step. It creates the S3 bucket every
other stack keeps its state in, so it cannot itself use that bucket — it is the
one stack with local state and no `backend.hcl`, initialised with a plain
`terraform init` and then applied:

```bash
cd terraform/stacks/bootstrap
terraform init
terraform apply
terraform output state_bucket        # -> rash-tfstate-<account-id>
```

Every stack after it is independent and needs its own `terraform.tfvars` and
`backend.hcl`, copied from the checked-in examples and pointed at that bucket;
see [terraform/README.md](../terraform/README.md) for the per-stack mechanics.

**Prerequisites**

- AWS CLI configured with a profile that has the permissions in the table above,
  plus read/write on the Terraform state bucket
- Terraform 1.11 or newer (S3-native state locking)
- Docker running, for the Lambda packaging steps
- Bedrock model access granted for both stacks' models — `researcher_model`
  (`bedrock/us.amazon.nova-pro-v1:0`) and `bedrock_model_id`
  (`us.amazon.nova-pro-v1:0`) — in every region their inference profiles route
  to, `us-west-2` included

**Order**

| # | Stack | Depends on | Notes |
|---|---|---|---|
| 0 | `stacks/bootstrap` | — | Creates the state bucket. Run once, before any other `init`. |
| 1 | `stacks/sagemaker` | — | Embedding endpoint. Smallest stack; a good first check that credentials work. |
| 2 | `stacks/ingestion` | sagemaker | Needs the endpoint name. |
| 3 | `stacks/researcher` | — | Build and push the ECR image before applying. |
| 4 | `stacks/database` | — | Must precede agents and frontend, which read its outputs. |
| 5 | `stacks/agents` | database | Run `package_docker.py` for all five agents first. |
| 6 | `stacks/frontend` | database, agents | Use `scripts/deploy.py`, which also builds and uploads the site. |
| 7 | `stacks/observability` | all of the above | Dashboards reference the other stacks' resources. |

Steps 1–3 are independent of each other and can be applied in any order. The
hard constraints are that bootstrap comes first, and that `database` precedes
`agents` and `frontend`.

Take `terraform output` from each stack as you go; later stacks' `tfvars` need
those values, and hand-copying stale ARNs is the most common cause of failures
here.

---

## Full redeploy procedure

Explained step by step below. For the bare copy-paste list of every command in order,
see [Appendix: exact command sequence](#appendix-exact-command-sequence).

**Prerequisite: Docker Desktop must be running.** Verify before starting — every
packaging script needs it:

```bash
docker info --format "Server: {{.ServerVersion}} | OS: {{.OSType}}"
```

### Step 1 — Database (only if schema/tables changed)

```bash
cd terraform/stacks/database
terraform apply
terraform output          # confirm dynamodb_table_names / dynamodb_table_arns exist
```

### Step 2 — Package the five agent Lambdas

Each takes several minutes and produces an ~86–88 MB zip. The **first** one is slowest
(it pulls `public.ecr.aws/lambda/python:3.12`); once that layer is cached the rest can
run **concurrently**, which is much faster than sequentially.

Run each in a subshell so the `cd` doesn't leak into the next command — chaining
bare `cd backend/tagger` after `cd backend/planner` resolves relative to the
*previous* directory and fails:

```bash
# from the repo root
(cd backend/planner    && uv run package_docker.py)
(cd backend/tagger     && uv run package_docker.py)
(cd backend/reporter   && uv run package_docker.py)
(cd backend/charter    && uv run package_docker.py)
(cd backend/retirement && uv run package_docker.py)
```

> These scripts print **nothing until they finish** (Python buffers stdout when piped).
> Silence is not a hang. To confirm real progress, check for a running container:
> ```bash
> docker ps --format "{{.Names}} | {{.Status}} | {{.Image}}"
> # -> ... | Up 3 minutes | public.ecr.aws/lambda/python:3.12
> ```

### Step 3 — Deploy the agents

Uploads the new zips and refreshes the agents' env vars:

```bash
cd terraform/stacks/agents
terraform apply
```

`terraform/stacks/agents/terraform.tfvars` must contain `dynamodb_table_names`. That file
is gitignored and also holds live Polygon / LangFuse / OpenAI keys — never paste it
into a chat, issue, or PR.

### Step 4 — Deploy the API Lambda + frontend

One script does packaging, `terraform apply` on `stacks/frontend`, the NextJS build, the S3
upload, and the CloudFront invalidation:

```bash
(cd scripts && PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run deploy.py)
```

The UTF-8 prefix is **required on Windows** — the script prints emoji and otherwise
dies instantly with `UnicodeEncodeError: 'charmap' codec can't encode character`.

**Where it is and isn't needed** (verified by checking each script for emoji):

| Script | Needs the prefix? |
|---|---|
| `scripts/deploy.py`, `run_local.py`, `destroy.py` | **Yes** — 31 / 25 / 15 emoji lines |
| `backend/api/package_docker.py` | Only if run directly. `deploy.py` sets `PYTHONUTF8` in its own environment, which child processes inherit |
| The five agent `backend/*/package_docker.py` | **No** — zero emoji; they run clean without it |
| `backend/database/verify_database.py` | **No** — zero emoji |

Harmless to add everywhere, so prefixing by reflex costs nothing.

---

## Verification toolkit

Deployment scripts printing ✅ is not verification. These are the checks that actually
prove something.

### 1. Are the Lambdas on the right database?

The single highest-value check after any migration:

```powershell
foreach ($f in @("rash-api","rash-planner","rash-tagger","rash-reporter","rash-charter","rash-retirement")) {
  $c = aws lambda get-function-configuration --function-name $f `
       --query "{LM:LastModified,Aurora:Environment.Variables.AURORA_CLUSTER_ARN,Users:Environment.Variables.DYNAMODB_USERS_TABLE}" `
       --output json | ConvertFrom-Json
  Write-Output "$f | $($c.LM) | aurora='$($c.Aurora)' | users=$($c.Users)"
}
```

Want: recent `LastModified`, empty `aurora`, populated `users`. **A `LastModified`
older than your last `stacks/database` apply is a red flag.**

### 2. Is the API actually reachable?

Do **not** test with a plain `curl` of an API path. CloudFront's two
`custom_error_response` blocks rewrite **403 and 404 into `200` serving `/index.html`**
across *all* cache behaviors — so a broken or unauthorized API request comes back as a
cheerful `200 text/html` from `Server: AmazonS3`. Deeply misleading.

Instead send a method the error pages don't remap, so FastAPI's own response survives:

```bash
CF_URL=$(cd terraform/stacks/frontend && terraform output -raw cloudfront_url)
curl -s -i -X GET "$CF_URL/api/analyze" | head -8
# want: HTTP/1.1 405 Method Not Allowed, Allow: POST, Apigw-Requestid: ...
```

`Apigw-Requestid` + a FastAPI error body proves the request traversed CloudFront →
API Gateway → Lambda. A `500` here means the Lambda ran and threw.

### 3. What did the Lambda actually throw?

```powershell
$since = [DateTimeOffset]::UtcNow.AddMinutes(-15).ToUnixTimeMilliseconds()
aws logs filter-log-events --log-group-name /aws/lambda/rash-api `
  --start-time $since --filter-pattern "?ERROR ?Traceback ?Exception" `
  --max-items 40 --query "events[].message" --output text
```

> Run AWS log commands in **PowerShell, not Git Bash**. Git Bash mangles
> `/aws/lambda/rash-api` into a Windows path and you get a confusing
> `InvalidParameterException ... failed to satisfy constraint` that looks like a
> permissions problem but is pure path munging. (Or prefix with `MSYS_NO_PATHCONV=1`.)

### 4. Is the data layer sound?

Read-only scan of every table plus referential-integrity checks:

```bash
cd backend/database
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run verify_database.py
```

Wants all tables `ACTIVE`, sane record counts, and no orphan accounts/positions/jobs.

### 5. Did the new frontend actually go live?

Compare the served chunk hash against your local build:

```bash
CF_URL=$(cd terraform/stacks/frontend && terraform output -raw cloudfront_url)
curl -s "$CF_URL/" | grep -o 'pages/index-[a-z0-9]*\.js'
ls frontend/out/_next/static/chunks/pages/ | grep index
```

Then hard-refresh (Ctrl+Shift+R) and confirm sign-in + dashboard load.

---

## Incident record: 2026-08-22

**Symptom.** Every action in the deployed UI returned
`500 {"detail":"An internal error occurred. Please try again later."}`. Dashboard,
accounts, and "Start new analysis" all failed; the analyses list showed
"No previous analyses found".

**What had happened.** The `migration/aurora-to-dynamodb` PR (#3) merged into `main`
that day, and its `terraform apply` in `stacks/database` **destroyed the Aurora cluster**.
But the Lambdas had last been deployed on Aug 17–18 and were never repackaged, so all
six still contained Aurora code and Aurora-only env vars.

Evidence chain:

```text
CloudWatch /aws/lambda/rash-api:
  Database error: HttpEndpointNotEnabledException ... calling ExecuteStatement ...
  HttpEndpoint is not enabled for resource ...:cluster:rash-aurora-cluster
  (repeated for get_or_create_user, listing jobs, listing accounts, triggering analysis)

aws rds describe-db-clusters --db-cluster-identifier rash-aurora-cluster
  -> DBClusterNotFoundFault          # the cluster was gone entirely

aws lambda get-function-configuration --function-name rash-api
  -> AURORA_CLUSTER_ARN set, no DYNAMODB_* vars, LastModified 2026-08-17
```

Notably the *code and config were already correct on `main`* —
`stacks/frontend/main.tf:216` and `stacks/agents/main.tf:245` both pass `DYNAMODB_*` vars,
`stacks/agents/terraform.tfvars` already listed the tables, and `backend/api/` plus all
agent source had **zero** Aurora references. Only the deployed artifacts were stale.
No code fix was required.

**Fix applied.** Exactly Steps 2–4 above: packaged all five agents, applied
`stacks/agents`, then ran `scripts/deploy.py` for the API and frontend.

**Result, verified.**

```text
all 6 Lambdas   -> LastModified 2026-08-22T22:12–22:15, aurora='', users=rash-users
Aurora errors   -> 0 in the following window
GET /api/analyze-> 405 Method Not Allowed, Allow: POST, Apigw-Requestid present
verify_database -> users 3 / instruments 28 / accounts 7 / positions 30 / jobs 26,
                   all ACTIVE, no orphans
```

**Lesson.** A green `terraform apply` means the *infrastructure* matches your config.
It says nothing about whether the deployed *code* matches that infrastructure. Those
drift independently, and the gap is invisible until a request hits the database.

---

## Windows gotchas (all hit for real)

| Symptom | Cause | Fix |
|---|---|---|
| `UnicodeEncodeError: 'charmap' codec can't encode` | scripts print emoji; stdout defaults to cp1252 | `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` |
| `InvalidParameterException` on a log group name | Git Bash rewrites `/aws/lambda/...` as a path | use PowerShell, or `MSYS_NO_PATHCONV=1` |
| `package_docker.py` produces no output for minutes | Python buffers piped stdout | normal — confirm via `docker ps` |
| `open //./pipe/dockerDesktopLinuxEngine: ... cannot find the file` | Docker Desktop not running | start it, wait for full init |
| Docker "mounts denied" | temp dir not shared | Docker Desktop → Settings → Resources → File Sharing |

---

## Appendix: exact command sequence

Every command from the 2026-08-22 recovery, in the order it was run. Copy-paste
runnable. Bash unless marked PowerShell; run from anywhere inside the repo.

**Run this first — it defines the variables every later block uses:**

```bash
# repo root, resolved rather than hard-coded
PROJ="$(git rev-parse --show-toplevel)"

# deployment targets, read from Terraform state rather than hard-coded
CF_URL=$(cd "$PROJ/terraform/stacks/frontend"  && terraform output -raw cloudfront_url)
BUCKET=$(cd "$PROJ/terraform/stacks/frontend"  && terraform output -raw s3_bucket_name)
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${CF_URL#https://}'].Id" --output text)

echo "$PROJ | $CF_URL | $BUCKET | $DIST_ID"
```

### A. Diagnose (read-only — safe to run any time)

```bash
# 0. who/where am I
aws sts get-caller-identity            # -> Account 494191147246, user/aiengineer
aws configure get region               # -> us-east-1

# 1. what is deployed
(cd "$PROJ/terraform/stacks/frontend" && terraform output)
(cd "$PROJ/terraform/stacks/database" && terraform output)   # confirm dynamodb_table_names exist

# 2. is the Lambda stale? (the money question)
aws lambda get-function-configuration --function-name rash-api \
  --query "{LastModified:LastModified,Runtime:Runtime,Timeout:Timeout,CodeSize:CodeSize}" \
  --output table

# 3. does the database it points at still exist?
aws rds describe-db-clusters --db-cluster-identifier rash-aurora-cluster
# -> DBClusterNotFoundFault  == the smoking gun
aws dynamodb list-tables --output text

# 4. is Docker up (needed before any packaging)
docker info --format "Server: {{.ServerVersion}} | OS: {{.OSType}}"
```

**PowerShell** for anything touching CloudWatch log groups (Git Bash mangles the
leading `/aws/...` into a Windows path):

```powershell
# recent errors, last 2 hours
$since = [DateTimeOffset]::UtcNow.AddHours(-2).ToUnixTimeMilliseconds()
aws logs filter-log-events --log-group-name /aws/lambda/rash-api `
  --start-time $since --filter-pattern "?ERROR ?Traceback ?Exception" `
  --max-items 60 --query "events[].message" --output text

# all six Lambdas at a glance: stale? still on Aurora?
foreach ($f in @("rash-api","rash-planner","rash-tagger","rash-reporter","rash-charter","rash-retirement")) {
  $c = aws lambda get-function-configuration --function-name $f `
       --query "{LM:LastModified,Aurora:Environment.Variables.AURORA_CLUSTER_ARN,Users:Environment.Variables.DYNAMODB_USERS_TABLE}" `
       --output json | ConvertFrom-Json
  Write-Output "$f | $($c.LM) | aurora='$($c.Aurora)' | users=$($c.Users)"
}
```

### B. Fix — package all five agents

Start the first alone (it pulls `public.ecr.aws/lambda/python:3.12`), then run the
other four **concurrently** once that layer is cached. Each prints nothing until it
finishes; that is buffering, not a hang.

A bare `wait` returns 0 even when a child failed, which would let a failed package
sail straight into `terraform apply` and deploy a stale zip. Capture each PID and
check it, and make the foreground build part of the same success condition:

```bash
# first one in the foreground: it pulls the base image, so let it finish alone
(cd "$PROJ/backend/planner" && uv run package_docker.py) || { echo "planner FAILED"; exit 1; }

# the rest concurrently against the warm layer cache
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

if [ -n "$failed" ]; then
  echo "PACKAGING FAILED:$failed — do NOT run terraform apply"; exit 1
fi
echo "all five packaged OK"
```

```bash
# confirm progress mid-build from another shell:
docker ps --format "{{.Names}} | {{.Status}} | {{.Image}}"
```

Each should end with `Package created: ...(86-88 MB)` and exit code 0. Only proceed
to section C once the guard above prints `all five packaged OK`.

### C. Fix — deploy agents, then API + frontend

```bash
# upload the five zips and swap agent env vars to DynamoDB
(cd "$PROJ/terraform/stacks/agents" && terraform apply -auto-approve) \
  || { echo "agents apply FAILED"; exit 1; }

# API Lambda + terraform stacks/frontend + NextJS build + S3 upload + CloudFront invalidation
(cd "$PROJ/scripts" && PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run deploy.py)
```

> The `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` prefix is **required on Windows**. It is a
> per-command environment variable, not a saved setting — you must retype it every
> time. Omit it and the script dies immediately with `UnicodeEncodeError` before doing
> any work. Nothing in the repo sets it; only these docs record it.
>
> PowerShell equivalent (no inline prefix syntax):
> ```powershell
> $env:PYTHONUTF8 = "1"; $env:PYTHONIOENCODING = "utf-8"; uv run deploy.py
> ```

### D. Verify (do all four — each proves a different layer)

```bash
# 1. did the new frontend actually go live? hashes must match
curl -s "$CF_URL/" | grep -o 'pages/index-[a-z0-9]*\.js'
ls "$PROJ/frontend/out/_next/static/chunks/pages/" | grep index

# 2. did the API survive? 405 (not 500) proves Lambda ran.
#    Use GET on a POST-only route: CloudFront rewrites 403/404 into 200 index.html.
curl -s -i -X GET "$CF_URL/api/analyze" | head -8
# want: HTTP/1.1 405 Method Not Allowed / Allow: POST / Apigw-Requestid: ...

# 3. is the data layer sound? (read-only scan + integrity check)
(cd "$PROJ/backend/database" && uv run verify_database.py)

# 4. cache headers landed correctly on HTML
aws s3api head-object --bucket "$BUCKET" --key index.html \
  --query "{ContentType:ContentType,CacheControl:CacheControl,LastModified:LastModified}" \
  --output table
```

**PowerShell** — confirm the original error class is gone:

```powershell
$since = [DateTimeOffset]::UtcNow.AddMinutes(-15).ToUnixTimeMilliseconds()
aws logs filter-log-events --log-group-name /aws/lambda/rash-api `
  --start-time $since --filter-pattern "HttpEndpointNotEnabled" `
  --query "length(events)" --output text
# want: 0
```

Finally, hard-refresh the site (Ctrl+Shift+R) and click through signed in — the CLI
checks above cannot exercise the authenticated database path.

---

## Cost note

DynamoDB on-demand costs far less at rest than the Aurora Serverless v2 cluster it
replaced, so leaving the database up between sessions is much cheaper than before.
The remaining meaningful spend is the SageMaker endpoint and the researcher
Lambda's ECR image. Destroying `stacks/observability` through `stacks/sagemaker`
in reverse dependency order (`observability` → `frontend` → `agents` →
`database` → `researcher` → `ingestion` → `sagemaker`) is a partial cost-stop,
not a full teardown: `stacks/bootstrap` and its state bucket stay. Keep an eye
on the AWS billing console regardless.
