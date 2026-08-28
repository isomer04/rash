terraform {
  required_version = ">= 1.11" # S3-native state locking (use_lockfile)

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.28.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data source for current caller identity
data "aws_caller_identity" "current" {}

locals {
  researcher_deployed = var.researcher_image_uri != ""
  scheduler_active    = var.scheduler_enabled && local.researcher_deployed
}

# ECR repository for the researcher Docker image
resource "aws_ecr_repository" "researcher" {
  name                 = "rash-researcher"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = {
    Project = "rash"
    Part    = "4"
  }
}

# Allow Lambda to pull images from ECR
resource "aws_ecr_repository_policy" "researcher_lambda_access" {
  repository = aws_ecr_repository.researcher.name

  policy = jsonencode({
    Version = "2008-10-17"
    Statement = [
      {
        Sid    = "LambdaEcrImageRetrievalPolicy"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Condition = {
          ArnLike = {
            "aws:sourceArn" = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:*"
          }
        }
      }
    ]
  })
}

# IAM role for researcher Lambda
resource "aws_iam_role" "researcher_lambda_role" {
  name = "rash-researcher-lambda-role"

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
    Part    = "4"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "researcher_lambda_basic" {
  role       = aws_iam_role.researcher_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Policy for researcher Lambda to access Bedrock
resource "aws_iam_role_policy" "researcher_lambda_bedrock_access" {
  name = "rash-researcher-lambda-bedrock-policy"
  role = aws_iam_role.researcher_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:ListFoundationModels"
        ]
        Resource = "*"
      }
    ]
  })
}

# Researcher Lambda function
resource "aws_lambda_function" "researcher" {
  count         = local.researcher_deployed ? 1 : 0
  function_name = "rash-researcher"
  package_type  = "Image"
  image_uri     = var.researcher_image_uri
  role          = aws_iam_role.researcher_lambda_role.arn
  timeout       = 300
  memory_size   = 2048
  architectures = ["x86_64"]

  # The Function URL below is public and unauthenticated, and every
  # invocation spends Bedrock tokens. This caps what that costs.
  reserved_concurrent_executions = var.researcher_reserved_concurrency

  ephemeral_storage {
    size = 2048
  }

  environment {
    variables = {
      OPENAI_API_KEY    = var.openai_api_key
      RASH_API_ENDPOINT = var.rash_api_endpoint
      RASH_API_KEY      = var.rash_api_key
      BEDROCK_REGION    = var.bedrock_region
      RESEARCHER_MODEL  = var.researcher_model
      MCP_LOGGING       = var.mcp_logging
    }
  }

  tags = {
    Project = "rash"
    Part    = "4"
  }
}

# Public function URL for the researcher service
resource "aws_lambda_function_url" "researcher" {
  count              = local.researcher_deployed ? 1 : 0
  function_name      = aws_lambda_function.researcher[0].function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "allow_public_function_url_invoke" {
  count                    = local.researcher_deployed ? 1 : 0
  statement_id             = "AllowPublicFunctionInvokeViaUrl"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.researcher[0].function_name
  principal                = "*"
  invoked_via_function_url = true
}

# IAM role for EventBridge
resource "aws_iam_role" "eventbridge_role" {
  count = local.scheduler_active ? 1 : 0
  name  = "rash-eventbridge-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project = "rash"
    Part    = "4"
  }
}

# Lambda function for invoking researcher
resource "aws_lambda_function" "scheduler_lambda" {
  count            = local.scheduler_active ? 1 : 0
  function_name    = "rash-researcher-scheduler"
  role             = aws_iam_role.lambda_scheduler_role[0].arn
  filename         = "${path.module}/../../../backend/scheduler/lambda_function.zip"
  source_code_hash = fileexists("${path.module}/../../../backend/scheduler/lambda_function.zip") ? filebase64sha256("${path.module}/../../../backend/scheduler/lambda_function.zip") : null
  handler          = "lambda_function.handler"
  runtime          = "python3.12"

  # Must exceed the researcher's own 300s timeout. When this was 180s the
  # trigger hard-timed-out on any slow run, which EventBridge counts as a
  # failed invocation and retries - each retry being another research run.
  timeout     = 360
  memory_size = 256

  environment {
    variables = {
      APP_RUNNER_URL = trimsuffix(aws_lambda_function_url.researcher[0].function_url, "/")
    }
  }

  tags = {
    Project = "rash"
    Part    = "4"
  }
}

# IAM role for scheduler Lambda
resource "aws_iam_role" "lambda_scheduler_role" {
  count = local.scheduler_active ? 1 : 0
  name  = "rash-scheduler-lambda-role"

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
    Part    = "4"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_scheduler_basic" {
  count      = local.scheduler_active ? 1 : 0
  role       = aws_iam_role.lambda_scheduler_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# EventBridge schedule
resource "aws_scheduler_schedule" "research_schedule" {
  count = local.scheduler_active ? 1 : 0
  name  = "rash-research-schedule"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = var.research_schedule_expression

  target {
    arn      = aws_lambda_function.scheduler_lambda[0].arn
    role_arn = aws_iam_role.eventbridge_role[0].arn

    # Without this block the service defaults to 185 retries over 24 hours.
    # A research run is not worth repeating that hard: if it failed, the
    # next scheduled run picks a fresh topic anyway.
    retry_policy {
      maximum_retry_attempts       = var.scheduler_max_retry_attempts
      maximum_event_age_in_seconds = 3600
    }
  }
}

# Permission for EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge" {
  count         = local.scheduler_active ? 1 : 0
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduler_lambda[0].function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.research_schedule[0].arn
}

# Policy for EventBridge to invoke Lambda
resource "aws_iam_role_policy" "eventbridge_invoke_lambda" {
  count = local.scheduler_active ? 1 : 0
  name  = "InvokeLambdaPolicy"
  role  = aws_iam_role.eventbridge_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.scheduler_lambda[0].arn
      }
    ]
  })
}
