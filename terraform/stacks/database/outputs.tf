output "dynamodb_table_names" {
  description = "DynamoDB table names consumed by the API and agents"
  value       = local.table_names
}

output "dynamodb_table_arns" {
  description = "DynamoDB table ARNs for least-privilege Lambda policies"
  value = {
    users       = aws_dynamodb_table.users.arn
    instruments = aws_dynamodb_table.instruments.arn
    accounts    = aws_dynamodb_table.accounts.arn
    positions   = aws_dynamodb_table.positions.arn
    jobs        = aws_dynamodb_table.jobs.arn
  }
}

output "aurora_cluster_arn" {
  description = "Legacy Aurora cluster ARN while retained for migration"
  value       = one(aws_rds_cluster.aurora[*].arn)
}

output "aurora_secret_arn" {
  description = "Legacy Aurora secret ARN while retained for migration"
  value       = one(aws_secretsmanager_secret.db_credentials[*].arn)
}

output "migration_status" {
  description = "Current database migration mode"
  value       = var.retain_aurora_for_migration ? "DynamoDB ready; Aurora retained for migration" : "DynamoDB active; Aurora removed"
}

output "setup_instructions" {
  description = "DynamoDB environment and migration instructions"
  value       = <<-EOT
    DynamoDB on-demand tables are ready:
    DYNAMODB_USERS_TABLE=${aws_dynamodb_table.users.name}
    DYNAMODB_INSTRUMENTS_TABLE=${aws_dynamodb_table.instruments.name}
    DYNAMODB_ACCOUNTS_TABLE=${aws_dynamodb_table.accounts.name}
    DYNAMODB_POSITIONS_TABLE=${aws_dynamodb_table.positions.name}
    DYNAMODB_JOBS_TABLE=${aws_dynamodb_table.jobs.name}

    Migration state: ${var.retain_aurora_for_migration ? "Aurora retained" : "Aurora removed"}
    The Aurora migration is complete and the cluster has been destroyed. Setting
    retain_aurora_for_migration=true recreates it; leave it false.
  EOT
}
