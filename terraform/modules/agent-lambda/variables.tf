variable "name" {
  description = "Agent name, used for the Lambda function name and log group (e.g. \"planner\")."
  type        = string
}

variable "role_arn" {
  description = "ARN of the IAM role the Lambda assumes."
  type        = string
}

variable "s3_bucket" {
  description = "S3 bucket holding the deployment package."
  type        = string
}

variable "s3_key" {
  description = "S3 key of the deployment package."
  type        = string
}

variable "package_path" {
  description = "Local path to the built zip, used only to compute source_code_hash."
  type        = string
}

variable "timeout" {
  description = "Lambda timeout in seconds."
  type        = number
  default     = 300
}

variable "memory_size" {
  description = "Lambda memory in MB."
  type        = number
  default     = 1024
}

variable "environment" {
  description = "Environment variables for the function."
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Tags applied to the function and log group."
  type        = map(string)
  default     = {}
}
