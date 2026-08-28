# Frontend Redeploy Runbook

How to push a frontend-only change live to S3 + CloudFront, without touching the
API Lambda or re-running Terraform.

**Use this when:** you changed something under `frontend/` (design, copy, components,
pages) and the backend is unchanged.

**Do NOT use this when:** you changed `backend/api/` or any Terraform config — see
[Full deploy](#full-deploy-when-the-backend-changed-too) at the bottom.

---

## Prerequisites

- `stacks/frontend` already applied (CloudFront, S3, API Gateway, Lambda `rash-api`)
- AWS CLI configured as the `aiengineer` IAM user, region `us-east-1`
- `node_modules` installed in `frontend/`
- Docker **not** required for this path

Verify you're pointed at the right account:

```bash
aws sts get-caller-identity     # Account should be 494191147246
aws configure get region        # us-east-1
```

---

## Step 0 — Get the deployment targets

Never hardcode these; read them from Terraform state so they stay correct if you
ever rebuild the infra.

```bash
cd terraform/stacks/frontend
terraform output
```

Current values (as of the 2026-08-22 deploy):

| Thing | Value |
|---|---|
| CloudFront URL | `https://d27voe79zmvxyl.cloudfront.net` |
| CloudFront distribution ID | `E1S13FT7Y8LTJS` |
| S3 bucket | `rash-frontend-494191147246` |
| API Gateway URL | `https://pln046fmb3.execute-api.us-east-1.amazonaws.com` |
| Lambda | `rash-api` |

The distribution ID also appears in the `setup_instructions` output.

---

## Step 1 — Branch

Branch from whatever actually contains the frontend changes you intend to ship —
usually `main`, but **not** unconditionally. If your work sits on a feature branch
that hasn't merged yet, checking out `main` first would deploy a build without it.

```bash
git status                      # confirm a clean tree before anything else
git branch --show-current       # what am I on?

# if the changes you want are already on main:
git checkout main && git pull

# if they're on a feature branch, stay on it (or branch from it) instead:
# git checkout <branch-with-the-redesign>

git checkout -b deploy/<something-descriptive>
```

Verify the branch really has the work before building — cheapest check is that the
files you changed look right:

```bash
git log --oneline -5 -- frontend/
```

> If `git status` is clean and your redesign still isn't live, the changes are
> already committed — the deploy is the only thing missing.

---

## Step 2 — Build the static export

`next.config.ts` has `output: 'export'`, so `next build` writes a fully static site
into `frontend/out/`.

```bash
cd frontend
rm -rf out          # PowerShell: Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
npm run build
```

Expect ~8 static pages and a `✓ Exporting (9/9)` line.

The Clerk keys come from `.env.production.local` / `.env.local` automatically.

### You do NOT need to set `NEXT_PUBLIC_API_URL`

This trips people up (it tripped up an earlier version of this runbook). The
deployed site does **not** use that variable at all:

- Every page imports `API_URL` from `frontend/lib/config.ts`, which decides at
  *runtime* by hostname — it returns `''` for any non-localhost host, so the app
  calls **relative `/api/*` paths**, which CloudFront routes to API Gateway.
- `frontend/lib/api.ts` is the only file that reads `NEXT_PUBLIC_API_URL`, and
  **nothing imports it** — it's dead code.

So setting that env var changes nothing about how the deployed app talks to the
API. The routing lives in the CloudFront `/api/*` cache behavior, not in the bundle.

---

## Step 3 — Sanity-check the build output

```bash
ls out/                       # index.html, dashboard.html, accounts/, _next/, ...
ls out/_next/static/chunks/pages/
```

You **will** see `localhost` inside the bundled JS. That is expected and harmless —
it's the dev branch of `frontend/lib/config.ts:7`
(`if (window.location.hostname === 'localhost')`) plus the dead `lib/api.ts`.
Neither fires when the site is served from CloudFront. Don't chase it.

Note the hash of `out/_next/static/chunks/pages/index-*.js` — you'll compare it
against what CloudFront serves in Step 6 to prove the new build actually went live.

---

## Step 4 — Upload to S3 (two passes, different cache headers)

The two passes matter. Hashed assets are immutable and should cache for a year;
HTML must never cache, or users keep getting the old page after a deploy.

**Pass 1 must sync the *whole* build, including HTML.** `--exclude` in an
`aws s3 sync --delete` also excludes those keys from deletion, so
`--delete --exclude "*.html"` never removes a stale page — delete a route and its
old `.html` lives in the bucket forever. Sync everything, then fix the HTML
metadata in pass 2.

```bash
BUCKET=$(cd ../terraform/stacks/frontend && terraform output -raw s3_bucket_name)

# pass 1 — complete source sync, deletes anything no longer in the build
aws s3 sync out/ "s3://$BUCKET/" \
  --delete \
  --cache-control "max-age=31536000,public"
```

`--delete` removes files no longer in the build. On the 2026-08-22 deploy this
cleaned out leftover Next.js starter art (`next.svg`, `vercel.svg`, `globe.svg`,
`window.svg`, `file.svg`, old `favicon.ico`).

**Pass 2 — overwrite the HTML with no-cache metadata.** Pass 1 just uploaded it
with a one-year cache header; this corrects it:

```bash
aws s3 cp out/ "s3://$BUCKET/" \
  --recursive \
  --exclude "*" \
  --include "*.html" \
  --content-type "text/html" \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"
```

Confirm the headers landed — this must run *after* pass 2, or you'll see pass 1's
one-year header and think the deploy is broken:

```bash
aws s3api head-object \
  --bucket "$BUCKET" \
  --key index.html \
  --query "{ContentType:ContentType,CacheControl:CacheControl,LastModified:LastModified,Size:ContentLength}" \
  --output table
```

---

## Step 5 — Invalidate CloudFront

```bash
CF_URL=$(cd ../terraform/stacks/frontend && terraform output -raw cloudfront_url)
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${CF_URL#https://}'].Id" --output text)

INV_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" --paths "/*" \
  --query "Invalidation.Id" --output text)
echo "invalidation $INV_ID on $DIST_ID"
```

Returns an invalidation ID with `Status: InProgress`. Usually completes in 1–3
minutes. (1,000 free invalidation paths/month — `/*` counts as one path.)

**Wait for it to finish before verifying.** Otherwise Step 6 can read an edge that
still holds the old objects and you'll conclude the deploy failed when it didn't:

```bash
aws cloudfront wait invalidation-completed \
  --distribution-id "$DIST_ID" --id "$INV_ID"
# blocks until Status: Completed
```

---

## Step 6 — Verify it's actually live

Only once the waiter above has returned. Compare the chunk hash CloudFront serves
against your local build; if they match, the new build is live — not a cached one.

```bash
curl -s "$CF_URL/" | grep -o 'pages/index-[a-z0-9]*\.js'
ls out/_next/static/chunks/pages/ | grep index
```

Also worth a quick status/size check:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}  size=%{size_download}\n" "$CF_URL/"
```

Then hard-refresh the site in a browser (Ctrl+Shift+R) and confirm sign-in works
and the dashboard loads data.

---

## Full deploy (when the backend changed too)

If you touched `backend/api/` or any Terraform, use the project script instead —
it packages the Lambda in Docker, runs `terraform apply`, then does the frontend
build + upload + invalidation:

```bash
uv run scripts/deploy.py
```

**Requires Docker Desktop to be running.** If it fails with a confusing uv warning
about nested projects, the real cause is almost always that Docker isn't running.

Note that `scripts/deploy.py` writes `frontend/.env.production.local` from
`.env.production` (or falls back to `.env.local`) and sets `NEXT_PUBLIC_API_URL`
in it. That has no effect on how the deployed site reaches the API: as covered in
Step 2, the pages read `lib/config.ts`, which returns `''` in production so
requests go to relative `/api/*` paths that CloudFront routes to API Gateway. The
manual path above passes no API URL at all, and doesn't need to.

---

## Gotchas

- **Stale content after deploy** → HTML uploaded with the wrong cache header, or
  you skipped the invalidation. Re-run Steps 4 (pass 2) and 5.
- **API calls return 500** → almost certainly a *backend* problem, not this deploy.
  Check `/aws/lambda/rash-api` in CloudWatch. If the Lambdas are older than your
  last `terraform apply` in `stacks/database`, they may be pointing at infrastructure
  that no longer exists — see the Aurora→DynamoDB entry in `TROUBLESHOOTING.md`.
- **API calls 404 / hit the wrong host** → this is CloudFront's `/api/*` cache
  behavior, not the bundle. Do not go looking for `NEXT_PUBLIC_API_URL`.
- **Clerk redirect loops** → check `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` in
  `.env.production.local`, and that the CloudFront domain is an allowed origin in
  the Clerk dashboard.
- **Terraform output empty** → you're in the wrong directory. Each `terraform/stacks/*`
  stack has its own independent state file in the shared S3 backend.
- **Don't commit `frontend/out/`** — it's build output and gitignored.

---

## Appendix: the whole thing as one block

Copy-paste, from repo root. Assumes infra is already up and only `frontend/` changed.

```bash
set -e   # stop at the first failure rather than deploying a half-built site

# 0. resolve targets from Terraform state - never hard-code them
PROJ="$(git rev-parse --show-toplevel)"
CF_URL=$(cd "$PROJ/terraform/stacks/frontend" && terraform output -raw cloudfront_url)
BUCKET=$(cd "$PROJ/terraform/stacks/frontend" && terraform output -raw s3_bucket_name)
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${CF_URL#https://}'].Id" --output text)
echo "$CF_URL | $BUCKET | $DIST_ID"

# 1. branch - from whatever holds the frontend work, NOT unconditionally main
git status                                   # must be clean
git checkout main && git pull                # skip if the work is on a feature branch
git checkout -b deploy/<name>

# 2. build the static export
cd "$PROJ/frontend"
rm -rf out
npm run build                                # want: 8 static pages, "Exporting (9/9)"

# 3. upload - full sync first (so --delete can remove stale HTML too),
#    then re-set the HTML metadata to no-cache
aws s3 sync out/ "s3://$BUCKET/" \
  --delete --cache-control "max-age=31536000,public"

aws s3 cp out/ "s3://$BUCKET/" \
  --recursive --exclude "*" --include "*.html" \
  --content-type "text/html" \
  --cache-control "max-age=0,no-cache,no-store,must-revalidate"

# 4. invalidate, then WAIT - verifying while InProgress can read a stale edge
INV_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" --paths "/*" --query "Invalidation.Id" --output text)
aws cloudfront wait invalidation-completed --distribution-id "$DIST_ID" --id "$INV_ID"

# 5. verify - headers (after pass 2), then that the served hash matches the build
aws s3api head-object --bucket "$BUCKET" --key index.html \
  --query "{ContentType:ContentType,CacheControl:CacheControl,LastModified:LastModified}" \
  --output table

curl -s -o /dev/null -w "HTTP %{http_code}  size=%{size_download}\n" "$CF_URL/"
curl -s "$CF_URL/" | grep -o 'pages/index-[a-z0-9]*\.js'
ls out/_next/static/chunks/pages/ | grep index      # hashes must match
```

Then hard-refresh (Ctrl+Shift+R) and click through signed in.

If the pages load but API calls return **500**, stop — that's a backend problem, not
this deploy. Go to `DEPLOYMENT.md`.

---

*Last real deploy documented here: 2026-08-22, invalidation `I7J1JPADSCDIZV1EBF9KFNUP3M`.*
