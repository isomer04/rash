terraform {
  required_version = ">= 1.11" # S3-native state locking (use_lockfile)

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # seconds_until_auto_pause (Aurora Serverless v2 scale-to-zero) was added in
      # 5.81.0, so the lower bound is required, not just the major version.
      version = ">= 5.81.0, < 6.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  common_tags = {
    Project   = "rash"
    Part      = "5"
    ManagedBy = "terraform"
    Database  = "dynamodb"
  }

  table_names = {
    users       = "${var.table_prefix}-users"
    instruments = "${var.table_prefix}-instruments"
    accounts    = "${var.table_prefix}-accounts"
    positions   = "${var.table_prefix}-positions"
    jobs        = "${var.table_prefix}-jobs"
  }
}

# DynamoDB on-demand tables have no provisioned idle capacity. Five tables keep
# the existing domain model simple and let the Python package preserve its API.

resource "aws_dynamodb_table" "users" {
  name         = local.table_names.users
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "clerk_user_id"

  attribute {
    name = "clerk_user_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.dynamodb_deletion_protection
  tags                        = local.common_tags
}

resource "aws_dynamodb_table" "instruments" {
  name         = local.table_names.instruments
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "symbol"

  attribute {
    name = "symbol"
    type = "S"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.dynamodb_deletion_protection
  tags                        = local.common_tags
}

resource "aws_dynamodb_table" "accounts" {
  name         = local.table_names.accounts
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "clerk_user_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "clerk_user_id-created_at-index"
    hash_key        = "clerk_user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.dynamodb_deletion_protection
  tags                        = local.common_tags
}

resource "aws_dynamodb_table" "positions" {
  name         = local.table_names.positions
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "account_id"
    type = "S"
  }

  attribute {
    name = "symbol"
    type = "S"
  }

  global_secondary_index {
    name            = "account_id-symbol-index"
    hash_key        = "account_id"
    range_key       = "symbol"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.dynamodb_deletion_protection
  tags                        = local.common_tags
}

resource "aws_dynamodb_table" "jobs" {
  name         = local.table_names.jobs
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "clerk_user_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "clerk_user_id-created_at-index"
    hash_key        = "clerk_user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.dynamodb_deletion_protection
  tags                        = local.common_tags
}

# Existing installations must first apply with retain_aurora_for_migration=true.
# These moved blocks preserve the current local state addresses while adding count.

moved {
  from = random_password.db_password
  to   = random_password.db_password[0]
}

moved {
  from = random_id.suffix
  to   = random_id.suffix[0]
}

moved {
  from = aws_secretsmanager_secret.db_credentials
  to   = aws_secretsmanager_secret.db_credentials[0]
}

moved {
  from = aws_secretsmanager_secret_version.db_credentials
  to   = aws_secretsmanager_secret_version.db_credentials[0]
}

moved {
  from = aws_db_subnet_group.aurora
  to   = aws_db_subnet_group.aurora[0]
}

moved {
  from = aws_security_group.aurora
  to   = aws_security_group.aurora[0]
}

moved {
  from = aws_rds_cluster.aurora
  to   = aws_rds_cluster.aurora[0]
}

moved {
  from = aws_rds_cluster_instance.aurora
  to   = aws_rds_cluster_instance.aurora[0]
}

moved {
  from = aws_iam_role.lambda_aurora_role
  to   = aws_iam_role.lambda_aurora_role[0]
}

moved {
  from = aws_iam_role_policy.lambda_aurora_policy
  to   = aws_iam_role_policy.lambda_aurora_policy[0]
}

moved {
  from = aws_iam_role_policy_attachment.lambda_basic
  to   = aws_iam_role_policy_attachment.lambda_basic[0]
}

resource "random_password" "db_password" {
  count            = var.retain_aurora_for_migration ? 1 : 0
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_id" "suffix" {
  count       = var.retain_aurora_for_migration ? 1 : 0
  byte_length = 4
}

resource "aws_secretsmanager_secret" "db_credentials" {
  count                   = var.retain_aurora_for_migration ? 1 : 0
  name                    = "rash-aurora-credentials-${random_id.suffix[0].hex}"
  recovery_window_in_days = 0
  tags                    = merge(local.common_tags, { Database = "legacy-aurora" })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  count     = var.retain_aurora_for_migration ? 1 : 0
  secret_id = aws_secretsmanager_secret.db_credentials[0].id
  secret_string = jsonencode({
    username = "rashadmin"
    password = random_password.db_password[0].result
  })
}

data "aws_vpc" "default" {
  count   = var.retain_aurora_for_migration ? 1 : 0
  default = true
}

data "aws_subnets" "default" {
  count = var.retain_aurora_for_migration ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default[0].id]
  }
}

resource "aws_db_subnet_group" "aurora" {
  count      = var.retain_aurora_for_migration ? 1 : 0
  name       = "rash-aurora-subnet-group"
  subnet_ids = data.aws_subnets.default[0].ids
  tags       = merge(local.common_tags, { Database = "legacy-aurora" })
}

resource "aws_security_group" "aurora" {
  count = var.retain_aurora_for_migration ? 1 : 0
  name  = "rash-aurora-sg"
  # Description changes force security-group replacement, which would detach the
  # live Aurora cluster during migration. Keep the original text until retirement.
  description = "Security group for Rash Aurora cluster"
  vpc_id      = data.aws_vpc.default[0].id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default[0].cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Database = "legacy-aurora" })
}

# Retained only until the DynamoDB migration verifies. This cluster is not
# storage-encrypted: enabling storage_encrypted on an existing cluster forces
# replacement and would destroy the data being migrated. The gap is time-boxed to
# the migration window and closes when retain_aurora_for_migration is set to
# false. Encrypting sooner requires a snapshot-copy-and-restore migration path.
resource "aws_rds_cluster" "aurora" {
  count                  = var.retain_aurora_for_migration ? 1 : 0
  cluster_identifier     = "rash-aurora-cluster"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "15.12"
  database_name          = "rash"
  master_username        = "rashadmin"
  master_password        = random_password.db_password[0].result
  enable_http_endpoint   = true
  db_subnet_group_name   = aws_db_subnet_group.aurora[0].name
  vpc_security_group_ids = [aws_security_group.aurora[0].id]

  serverlessv2_scaling_configuration {
    min_capacity             = var.min_capacity
    max_capacity             = var.max_capacity
    seconds_until_auto_pause = var.min_capacity == 0 ? var.aurora_seconds_until_auto_pause : null
  }

  enabled_cloudwatch_logs_exports = ["postgresql"]

  backup_retention_period      = 7
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"
  apply_immediately            = true
  skip_final_snapshot          = !var.create_final_aurora_snapshot
  final_snapshot_identifier    = var.create_final_aurora_snapshot ? "rash-aurora-final-${random_id.suffix[0].hex}" : null
  tags                         = merge(local.common_tags, { Database = "legacy-aurora" })
}

resource "aws_rds_cluster_instance" "aurora" {
  count                        = var.retain_aurora_for_migration ? 1 : 0
  identifier                   = "rash-aurora-instance-1"
  cluster_identifier           = aws_rds_cluster.aurora[0].id
  instance_class               = "db.serverless"
  engine                       = aws_rds_cluster.aurora[0].engine
  engine_version               = aws_rds_cluster.aurora[0].engine_version
  performance_insights_enabled = false
  tags                         = merge(local.common_tags, { Database = "legacy-aurora" })
}

resource "aws_iam_role" "lambda_aurora_role" {
  count = var.retain_aurora_for_migration ? 1 : 0
  name  = "rash-lambda-aurora-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = merge(local.common_tags, { Database = "legacy-aurora" })
}

resource "aws_iam_role_policy" "lambda_aurora_policy" {
  count = var.retain_aurora_for_migration ? 1 : 0
  name  = "rash-lambda-aurora-policy"
  role  = aws_iam_role.lambda_aurora_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds-data:ExecuteStatement",
          "rds-data:BatchExecuteStatement",
          "rds-data:BeginTransaction",
          "rds-data:CommitTransaction",
          "rds-data:RollbackTransaction"
        ]
        Resource = aws_rds_cluster.aurora[0].arn
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.db_credentials[0].arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  count      = var.retain_aurora_for_migration ? 1 : 0
  role       = aws_iam_role.lambda_aurora_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
