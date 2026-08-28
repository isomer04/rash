# Remote state, configured as a *partial* backend.
#
# The bucket name embeds the AWS account ID, which is not committed. Supply the
# real values from the gitignored backend.hcl next to this file:
#
#   terraform init -backend-config=backend.hcl
#
# Copy backend.hcl.example to backend.hcl and fill it in with the outputs of
# `terraform output` in stacks/bootstrap.

terraform {
  backend "s3" {}
}
