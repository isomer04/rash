variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "openai_api_key" {
  description = "OpenAI API key for the researcher agent"
  type        = string
  sensitive   = true
}

variable "rash_api_endpoint" {
  description = "Rash API endpoint from Part 3"
  type        = string
}

variable "rash_api_key" {
  description = "Rash API key from Part 3"
  type        = string
  sensitive   = true
}

variable "scheduler_enabled" {
  description = "Enable automated research scheduler"
  type        = bool
  default     = false
}

variable "researcher_image_uri" {
  description = "Full ECR image URI for the researcher Lambda container"
  type        = string
  default     = ""
}

variable "bedrock_region" {
  description = "AWS region used for Bedrock model inference"
  type        = string
  default     = "us-west-2"
}

variable "researcher_model" {
  description = "Bedrock model identifier used by the researcher"
  type        = string
  default     = "bedrock/global.openai.gpt-oss-120b-1:0"
}

variable "mcp_logging" {
  description = "Set to exact string True to enable researcher MCP logging"
  type        = string
  default     = "False"
}

# ========================================
# Cost controls
# ========================================
#
# The scheduled researcher was ~100% of this project's Bedrock spend: every run
# is a multi-turn agent that pulls scraped web pages into its context, so input
# tokens dominate the bill by roughly 130:1 over output.

variable "research_schedule_expression" {
  description = <<-EOT
    How often the scheduler triggers an automated research run. Each run costs
    real Bedrock tokens whether or not anyone is using the app, so this is the
    single biggest cost lever in the project. `rate(2 hours)` is 12 runs a day;
    the default here is 1 a day. Set scheduler_enabled = false to stop them
    entirely.
  EOT
  type        = string
  default     = "rate(1 day)"
}

variable "researcher_reserved_concurrency" {
  description = <<-EOT
    Reserved concurrent executions for the researcher Lambda. The Function URL
    is public and unauthenticated, so this would otherwise be the hard ceiling
    on how much Bedrock anyone who finds the URL can spend.

    Defaults to -1 (no reservation), because AWS refuses any reservation that
    drops the account's unreserved pool below 10 - and this account's total
    concurrency limit is exactly 10, so no positive value is accepted. That
    account limit is itself the ceiling until a limit increase is granted.
    Once the account limit is raised, set this to 2.
  EOT
  type        = number
  default     = -1
}

variable "scheduler_max_retry_attempts" {
  description = <<-EOT
    Retries EventBridge Scheduler makes when the trigger Lambda fails. Each
    retry starts another full research run, and the service default is 185 over
    24 hours - enough to turn one slow run into a very large bill.
  EOT
  type        = number
  default     = 1
}
