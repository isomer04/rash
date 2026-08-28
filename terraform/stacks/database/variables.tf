variable "aws_region" {
  description = "AWS region for database resources"
  type        = string
}

variable "table_prefix" {
  description = "Prefix used for all Rash DynamoDB table names"
  type        = string
  default     = "rash"
}

variable "enable_point_in_time_recovery" {
  description = "Enable DynamoDB point-in-time recovery for all application tables"
  type        = bool
  default     = true
}

variable "dynamodb_deletion_protection" {
  description = "Prevent accidental DynamoDB table deletion. Disable deliberately before terraform destroy."
  type        = bool
  default     = false
}

variable "retain_aurora_for_migration" {
  description = "Keep the legacy Aurora cluster while data is copied to DynamoDB. The migration is complete and the cluster has been destroyed, so this should stay false; setting it true recreates the cluster."
  type        = bool
  default     = false
}

variable "create_final_aurora_snapshot" {
  description = "Create a final Aurora snapshot when retain_aurora_for_migration changes to false"
  type        = bool
  default     = true
}

variable "min_capacity" {
  description = "Legacy Aurora minimum ACUs while retained for migration"
  type        = number
  default     = 0
}

variable "max_capacity" {
  description = "Legacy Aurora maximum ACUs while retained for migration"
  type        = number
  default     = 1
}

variable "aurora_seconds_until_auto_pause" {
  description = "Idle seconds before the retained Aurora migration cluster auto-pauses when min_capacity is zero"
  type        = number
  default     = 300

  validation {
    condition     = var.aurora_seconds_until_auto_pause >= 300 && var.aurora_seconds_until_auto_pause <= 86400
    error_message = "Aurora Serverless v2 accepts an auto-pause window between 300 and 86400 seconds."
  }
}
