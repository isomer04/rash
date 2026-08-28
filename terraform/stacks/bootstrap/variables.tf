variable "aws_region" {
  description = "AWS region for the state bucket. Must match the `region` in every stack's backend.hcl."
  type        = string
  default     = "us-east-1"
}
