# Bootstrap: the S3 bucket that stores every other stack's Terraform state.
#
# This is the one stack that cannot use the remote backend, because it creates
# it. It keeps a local state file, which is acceptable: it manages a single
# bucket and can be recreated by import if the local state is ever lost.
#
# Locking uses the S3 backend's native lockfile (`use_lockfile = true`), which
# is GA as of Terraform 1.11. The old DynamoDB lock table is deprecated and is
# deliberately not created here.

terraform {
  required_version = ">= 1.11"

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

data "aws_caller_identity" "current" {}

locals {
  bucket_name = "rash-tfstate-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project   = "rash"
    Stack     = "bootstrap"
    ManagedBy = "terraform"
  }
}

resource "aws_s3_bucket" "state" {
  bucket = local.bucket_name

  # State is the record of every deployed resource. Losing it is far more
  # expensive than recreating this bucket, so deletion is blocked.
  lifecycle {
    prevent_destroy = true
  }

  tags = local.tags
}

# Versioning is what makes a corrupted or truncated state recoverable.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# State files contain resource attributes and can contain secrets.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Old state versions accumulate on every apply; expire them rather than
# paying for them forever. 90 days is well past any realistic rollback window.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
