terraform {
  required_version = ">= 1.11" # S3-native state locking (use_lockfile)

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

}

provider "aws" {
  region = var.aws_region
}

# Data source for current caller identity
data "aws_caller_identity" "current" {}

locals {
  dynamodb_table_arns = [
    for table_name in values(var.dynamodb_table_names) :
    "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${table_name}"
  ]
}

# ========================================
# SQS Queue for Async Job Processing
# ========================================

resource "aws_sqs_queue" "analysis_jobs" {
  name                       = "rash-analysis-jobs"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 10    # Long polling
  visibility_timeout_seconds = 910   # 15 minutes + 10 seconds buffer (matches Planner Lambda timeout)

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.analysis_jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Project = "rash"
    Part    = "6"
  }
}

resource "aws_sqs_queue" "analysis_jobs_dlq" {
  name = "rash-analysis-jobs-dlq"

  tags = {
    Project = "rash"
    Part    = "6"
  }
}

# ========================================
# IAM Role for Lambda Functions
# ========================================

resource "aws_iam_role" "lambda_agents_role" {
  name = "rash-lambda-agents-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project = "rash"
    Part    = "6"
  }
}

# IAM policy for Lambda agents
resource "aws_iam_role_policy" "lambda_agents_policy" {
  name = "rash-lambda-agents-policy"
  role = aws_iam_role.lambda_agents_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      },
      # SQS access for orchestrator
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.analysis_jobs.arn
      },
      # Lambda invocation for orchestrator to call other agents
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:rash-*"
      },
      # DynamoDB application data access
      {
        Effect = "Allow"
        Action = [
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem"
        ]
        Resource = concat(
          local.dynamodb_table_arns,
          [for arn in local.dynamodb_table_arns : "${arn}/index/*"]
        )
      },
      # S3 Vectors access for all agents
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.vector_bucket}",
          "arn:aws:s3:::${var.vector_bucket}/*"
        ]
      },
      # S3 Vectors API access for all agents
      {
        Effect = "Allow"
        Action = [
          "s3vectors:QueryVectors",
          "s3vectors:GetVectors"
        ]
        Resource = "arn:aws:s3vectors:${var.aws_region}:${data.aws_caller_identity.current.account_id}:bucket/${var.vector_bucket}/index/*"
      },
      # SageMaker endpoint access for reporter agent
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = "arn:aws:sagemaker:${var.aws_region}:${data.aws_caller_identity.current.account_id}:endpoint/${var.sagemaker_endpoint}"
      },
      # Bedrock access for all agents
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        # Replaced ${var.bedrock_region} with * for Bedrock region workaround
        Resource = [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*"
        ]
      }
    ]
  })
}

# Attach basic Lambda execution role
resource "aws_iam_role_policy_attachment" "lambda_agents_basic" {
  role       = aws_iam_role.lambda_agents_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ========================================
# S3 Bucket for Lambda Deployments
# ========================================

# S3 bucket for Lambda packages (packages > 50MB must use S3)
resource "aws_s3_bucket" "lambda_packages" {
  bucket = "rash-lambda-packages-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project = "rash"
    Part    = "6"
  }
}

# Upload Lambda packages to S3
resource "aws_s3_object" "lambda_packages" {
  for_each = toset(["planner", "tagger", "reporter", "charter", "retirement"])

  bucket = aws_s3_bucket.lambda_packages.id
  key    = "${each.key}/${each.key}_lambda.zip"
  source = "${path.module}/../../../backend/${each.key}/${each.key}_lambda.zip"

  # These packages exceed the multipart upload threshold, so S3 reports an ETag
  # of "<hash>-<partcount>" which can never equal filemd5. Using etag here means
  # a perpetual diff on every plan; source_hash is compared locally instead.
  source_hash = fileexists("${path.module}/../../../backend/${each.key}/${each.key}_lambda.zip") ? filemd5("${path.module}/../../../backend/${each.key}/${each.key}_lambda.zip") : null

  tags = {
    Project = "rash"
    Part    = "6"
    Agent   = each.key
  }
}

# ========================================
# Lambda Functions for Each Agent
# ========================================

locals {
  # Environment shared by all five agents.
  agent_common_env = {
    DYNAMODB_USERS_TABLE       = var.dynamodb_table_names.users
    DYNAMODB_INSTRUMENTS_TABLE = var.dynamodb_table_names.instruments
    DYNAMODB_ACCOUNTS_TABLE    = var.dynamodb_table_names.accounts
    DYNAMODB_POSITIONS_TABLE   = var.dynamodb_table_names.positions
    DYNAMODB_JOBS_TABLE        = var.dynamodb_table_names.jobs
    BEDROCK_MODEL_ID           = var.bedrock_model_id
    BEDROCK_REGION             = var.bedrock_region
    DEFAULT_AWS_REGION         = var.aws_region
    # LangFuse observability (optional)
    LANGFUSE_PUBLIC_KEY = var.langfuse_public_key
    LANGFUSE_SECRET_KEY = var.langfuse_secret_key
    LANGFUSE_HOST       = var.langfuse_host
    OPENAI_API_KEY      = var.openai_api_key
  }

  # Per-agent sizing, extra environment, and the Agent tag value.
  agents = {
    planner = {
      timeout     = 900  # 15 minutes for the orchestrator
      memory_size = 2048 # 2GB for the orchestrator
      agent_tag   = "orchestrator"
      extra_env = {
        VECTOR_BUCKET      = var.vector_bucket
        SAGEMAKER_ENDPOINT = var.sagemaker_endpoint
        POLYGON_API_KEY    = var.polygon_api_key
        POLYGON_PLAN       = var.polygon_plan
      }
    }
    tagger = {
      timeout     = 300
      memory_size = 1024
      agent_tag   = "tagger"
      extra_env   = {}
    }
    reporter = {
      timeout     = 300
      memory_size = 1024
      agent_tag   = "reporter"
      extra_env = {
        SAGEMAKER_ENDPOINT = var.sagemaker_endpoint
      }
    }
    charter = {
      timeout     = 300
      memory_size = 1024
      agent_tag   = "charter"
      extra_env   = {}
    }
    retirement = {
      timeout     = 300
      memory_size = 1024
      agent_tag   = "retirement"
      extra_env   = {}
    }
  }
}

module "agents" {
  source   = "../../modules/agent-lambda"
  for_each = local.agents

  name         = each.key
  role_arn     = aws_iam_role.lambda_agents_role.arn
  s3_bucket    = aws_s3_bucket.lambda_packages.id
  s3_key       = aws_s3_object.lambda_packages[each.key].key
  package_path = "${path.module}/../../../backend/${each.key}/${each.key}_lambda.zip"

  timeout     = each.value.timeout
  memory_size = each.value.memory_size
  environment = merge(local.agent_common_env, each.value.extra_env)

  tags = {
    Project = "rash"
    Part    = "6"
    Agent   = each.value.agent_tag
  }

  depends_on = [aws_s3_object.lambda_packages]
}

# SQS trigger for the Planner, which orchestrates the other four agents.
resource "aws_lambda_event_source_mapping" "planner_sqs" {
  event_source_arn = aws_sqs_queue.analysis_jobs.arn
  function_name    = module.agents["planner"].function_arn
  batch_size       = 1
}
