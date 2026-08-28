output "state_bucket" {
  description = "Name of the state bucket. Use this as `bucket` in each stack's backend.hcl."
  value       = aws_s3_bucket.state.id
}

output "state_bucket_region" {
  description = "Region of the state bucket. Use this as `region` in each stack's backend.hcl."
  value       = var.aws_region
}

output "backend_hcl_example" {
  description = "Ready-made backend.hcl contents for a stack named <stack>."
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.state.id}"
    key          = "<stack>/terraform.tfstate"
    region       = "${var.aws_region}"
    encrypt      = true
    use_lockfile = true
  EOT
}
