#!/usr/bin/env python3
"""
Destroy the Rash Financial Advisor Part 7 infrastructure.
This script:
1. Empties the S3 bucket
2. Destroys infrastructure with Terraform
3. Cleans up local artifacts
"""

import subprocess
import sys
import os
from pathlib import Path


def run_command(cmd, cwd=None, check=True, capture_output=False):
    """Run a command and optionally capture output."""
    print(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")

    if capture_output:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, shell=isinstance(cmd, str))
        if check and result.returncode != 0:
            print(f"Error: {result.stderr}")
            return None
        return result.stdout.strip()
    else:
        result = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str))
        if check and result.returncode != 0:
            return False
        return True


def ensure_backend(terraform_dir):
    """Initialise the stack's partial S3 backend. False if that is impossible."""
    backend_config = terraform_dir / "backend.hcl"
    if not backend_config.exists():
        print(f"  ❌ Missing {backend_config}")
        print("     Copy backend.hcl.example to backend.hcl and fill it in.")
        return False

    # Run init unconditionally. An existing .terraform records whichever backend
    # was configured last, which may no longer match backend.hcl; Terraform
    # refuses to continue on a mismatch rather than destroying against the
    # wrong state.
    print("  Initializing Terraform backend...")
    result = subprocess.run(
        ["terraform", "init", "-input=false", "-backend-config=backend.hcl"],
        cwd=terraform_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  ❌ terraform init failed: {result.stderr[:300]}")
        return False
    return True


def confirm_destruction():
    """Ask for confirmation before destroying resources."""
    print("⚠️  WARNING: This will destroy all Part 7 infrastructure!")
    print("This includes:")
    print("  - CloudFront distribution")
    print("  - API Gateway")
    print("  - Lambda function")
    print("  - S3 bucket and all contents")
    print("  - IAM roles and policies")
    print("")

    response = input("Are you sure you want to continue? Type 'yes' to confirm: ")
    return response.lower() == 'yes'


def get_bucket_name():
    """Get the S3 bucket name from Terraform output."""
    terraform_dir = Path(__file__).parent.parent / "terraform" / "stacks" / "frontend"

    if not terraform_dir.exists():
        print(f"  ❌ Terraform directory not found: {terraform_dir}")
        return None

    if not ensure_backend(terraform_dir):
        return None

    # Get the bucket name from Terraform
    bucket_output = run_command(
        ["terraform", "output", "-raw", "s3_bucket_name"],
        cwd=terraform_dir,
        capture_output=True
    )

    return bucket_output if bucket_output else None


def empty_s3_bucket(bucket_name):
    """Empty the S3 bucket before deletion."""
    if not bucket_name:
        print("  ⚠️  No bucket name provided, skipping...")
        return

    print(f"\n🗑️  Emptying S3 bucket: {bucket_name}")

    # Check if bucket exists
    exists = run_command(
        ["aws", "s3", "ls", f"s3://{bucket_name}"],
        capture_output=True,
        check=False
    )

    if not exists:
        print(f"  Bucket {bucket_name} doesn't exist or is already empty")
        return

    # Delete all objects
    print(f"  Deleting all objects from {bucket_name}...")
    run_command([
        "aws", "s3", "rm",
        f"s3://{bucket_name}/",
        "--recursive"
    ])

    # Delete all versions (if versioning is enabled)
    print(f"  Deleting all object versions...")
    run_command([
        "aws", "s3api", "delete-objects",
        "--bucket", bucket_name,
        "--delete", "$(aws s3api list-object-versions --bucket " + bucket_name + " --output json --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}')"
    ], check=False)

    print(f"  ✅ Bucket {bucket_name} emptied")


def destroy_terraform():
    """Destroy infrastructure with Terraform."""
    print("\n🏗️  Destroying infrastructure with Terraform...")

    terraform_dir = Path(__file__).parent.parent / "terraform" / "stacks" / "frontend"

    if not terraform_dir.exists():
        print(f"  ❌ Terraform directory not found: {terraform_dir}")
        return False

    # An uninitialised backend means we cannot know whether anything is
    # deployed. Reporting success would claim a teardown that never ran.
    if not ensure_backend(terraform_dir):
        return False

    # Destroy the infrastructure
    print("  Running terraform destroy...")
    print("  Type 'yes' when prompted to confirm destruction.")

    success = run_command(["terraform", "destroy"], cwd=terraform_dir)

    if success:
        print("  ✅ Infrastructure destroyed successfully")
    else:
        print("  ❌ Failed to destroy infrastructure")
        print("  You may need to manually clean up resources in AWS Console")

    return success


def clean_local_artifacts():
    """Clean up local build artifacts."""
    print("\n🧹 Cleaning up local artifacts...")

    artifacts = [
        Path(__file__).parent.parent / "backend" / "api" / "api_lambda.zip",
        Path(__file__).parent.parent / "frontend" / "out",
        Path(__file__).parent.parent / "frontend" / ".next",
    ]

    for artifact in artifacts:
        if artifact.exists():
            if artifact.is_file():
                artifact.unlink()
                print(f"  Deleted: {artifact}")
            else:
                import shutil
                shutil.rmtree(artifact)
                print(f"  Deleted directory: {artifact}")

    print("  ✅ Local artifacts cleaned")


def main():
    """Main destruction function."""
    print("💥 Rash Financial Advisor - Part 7 Infrastructure Destruction")
    print("=" * 60)

    # Confirm destruction
    if not confirm_destruction():
        print("\n❌ Destruction cancelled")
        sys.exit(0)

    # Get bucket name before destroying infrastructure
    bucket_name = get_bucket_name()

    # Empty S3 bucket first (required before Terraform can delete it)
    if bucket_name:
        empty_s3_bucket(bucket_name)

    # Destroy Terraform infrastructure
    destroyed = destroy_terraform()

    # Clean local artifacts
    clean_local_artifacts()

    print("\n" + "=" * 60)
    if not destroyed:
        # Local artifacts are gone but the AWS resources are not. Reporting
        # success here would leave the account billing for infrastructure the
        # operator believes was torn down.
        print("❌ Destruction incomplete - AWS resources may still exist.")
        print("   Fix the error above and re-run, or clean up in the AWS Console.")
        sys.exit(1)

    print("✅ Destruction complete!")
    print("\nTo redeploy, run:")
    print("  uv run scripts/deploy.py")


if __name__ == "__main__":
    main()