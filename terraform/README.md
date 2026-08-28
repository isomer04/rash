# Terraform Infrastructure

Infrastructure for the Rash financial planning platform.

## Layout

```
terraform/
├── modules/                 # Reusable modules. No provider or backend blocks.
│   └── agent-lambda/        # One analysis agent: Lambda + log group
└── stacks/                  # Root modules. One state file each.
    ├── bootstrap/           # S3 bucket holding every other stack's state
    ├── sagemaker/           # Serverless embedding endpoint
    ├── ingestion/           # S3 Vectors, ingest Lambda, API-key REST API
    ├── researcher/          # ECR repository, researcher Lambda Function URL
    ├── database/            # DynamoDB tables, staged Aurora retirement
    ├── agents/              # SQS queue and the five analysis agents
    ├── frontend/            # API Lambda, HTTP API, S3 site, CloudFront
    └── observability/       # CloudWatch dashboards and alarms
```

## Why separate stacks

Each stack is an independently deployable component with its own state file,
which keeps the blast radius of any change inside one stack.

This matters operationally: `database` and `sagemaker` are the two significant
cost centres, and the normal working pattern is to destroy them when not
actively developing. That is only safe while their state is isolated.

The tradeoff is that cross-stack values must be passed explicitly. Prefer
`terraform_remote_state` over copying ARNs into `terraform.tfvars` by hand —
hand-copied values drift, and are a common source of region and ARN
mismatches.

## First-time setup

The state bucket has to exist before any other stack can initialise.

```bash
# 1. Create the state bucket. This stack alone keeps local state.
cd terraform/stacks/bootstrap
terraform init
terraform apply
terraform output state_bucket        # -> rash-tfstate-<account-id>

# 2. Point a stack at it. backend.hcl is gitignored; the example is not.
cd ../sagemaker
cp backend.hcl.example backend.hcl
$EDITOR backend.hcl                  # fill in bucket and region

terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Repeat step 2 for each stack. The `key` in `backend.hcl` must be unique per
stack — the examples are already correct.

## Everyday use

```bash
cd terraform/stacks/<stack>
terraform init -backend-config=backend.hcl   # once per machine, or after module changes
terraform plan
terraform apply
```

State locking uses the S3 backend's native lockfile (`use_lockfile = true`),
which has been GA since Terraform 1.11. The older DynamoDB lock table is
deprecated and is deliberately not used.

## Configuration

Every stack needs a `terraform.tfvars` (gitignored) copied from its
`terraform.tfvars.example`. Values that flow between stacks come from the
previous stack's `terraform output`.

Some stacks also read from the repo-root `.env`:

| Variable | Source |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI account (researcher) |
| `RASH_API_ENDPOINT`, `RASH_API_KEY` | `stacks/ingestion` outputs |
| `VECTOR_BUCKET` | `stacks/ingestion` outputs |
| `DYNAMODB_*_TABLE` | `stacks/database` outputs |
| `BEDROCK_MODEL_ID` | Chosen model, must have Bedrock access granted |

## Modules

`modules/agent-lambda` exists because the five agents (planner, tagger,
reporter, charter, retirement) differ only in name, timeout, memory, and a few
environment variables. They were previously five near-identical resource
blocks. Per-agent differences live in the `agents` local in
`stacks/agents/main.tf`.

Modules must not declare `provider` or `backend` blocks — those belong to the
root module, so that a module stays usable from any stack.

## Troubleshooting

**`Backend initialization required`** — you skipped `-backend-config=backend.hcl`,
or `backend.hcl` does not exist yet. Copy it from the example.

**`Error acquiring the state lock`** — another apply is running, or one crashed.
Confirm nothing else is applying, then `terraform force-unlock <lock-id>`.

**Plan wants to destroy and recreate everything** — usually the wrong `key` in
`backend.hcl`, pointing at an empty state. Check it before applying.

**Missing cross-stack values** — run `terraform output` in the stack that owns
them. Do not guess ARNs.

Before any destroy, check the data-retention impact. Never delete state while
the AWS resources still exist; import or restore instead.

```bash
terraform plan -destroy
```
