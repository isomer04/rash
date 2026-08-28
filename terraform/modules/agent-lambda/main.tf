# One analysis agent: a Lambda function plus its log group.
# The five Rash agents differ only in name, sizing, and a few environment
# variables, so they are all instances of this module.

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_lambda_function" "this" {
  function_name = "rash-${var.name}"
  role          = var.role_arn

  # Packages exceed the 50MB direct-upload limit, so they ship via S3.
  s3_bucket        = var.s3_bucket
  s3_key           = var.s3_key
  source_code_hash = fileexists(var.package_path) ? filebase64sha256(var.package_path) : null

  handler     = "lambda_handler.lambda_handler"
  runtime     = "python3.12"
  timeout     = var.timeout
  memory_size = var.memory_size

  environment {
    variables = var.environment
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/rash-${var.name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}
