#!/usr/bin/env python3
"""Shared Lambda packaging for the Rash agents.

Every agent packages identically: export the locked requirements, install them
for linux/amd64 inside the AWS Lambda runtime image, add the shared path
dependencies, copy the agent's own modules, and zip the result. Each agent used
to keep its own 148-line copy of this; they differed only in names.

Agent entry points stay in place as thin wrappers, so both
`cd backend/<agent> && uv run package_docker.py` and the `backend/package_docker.py`
fan-out keep working.
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

# Shared path dependencies, installed with --no-deps after the locked
# requirements. Keys are directory names under backend/.
SHARED_PACKAGES = ("database", "observability")

# Packages that resolve fine locally but are dead weight or broken in Lambda.
EXCLUDED_FROM_LAMBDA = ("pyperclip",)

# Files in an agent directory that are tooling or tests, not runtime modules.
# Everything else that is a .py file gets packaged, so adding a new module to an
# agent needs no change here — the old per-agent scripts hardcoded the list and
# would silently omit one.
NON_RUNTIME_PREFIXES = ("test_", "try_", "track_")
NON_RUNTIME_NAMES = ("package_docker.py",)


def run_command(cmd, cwd=None):
    """Run a command, exiting with its stderr on failure."""
    print(f"Running: {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        sys.exit(1)
    return result.stdout


def runtime_modules(agent_dir: Path):
    """The agent's own .py files that belong in the deployment package."""
    return sorted(
        p
        for p in agent_dir.glob("*.py")
        if p.name not in NON_RUNTIME_NAMES
        and not p.name.startswith(NON_RUNTIME_PREFIXES)
    )


def package_lambda(agent_dir: Path) -> Path:
    """Build the deployment zip for one agent and return its path."""
    agent = agent_dir.name
    backend_dir = agent_dir.parent

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        package_dir = temp_path / "package"
        package_dir.mkdir()

        print("Creating Lambda package using Docker...")

        # --no-emit-project excludes the agent itself; its modules are copied in
        # directly below rather than installed.
        print("Exporting requirements from uv.lock...")
        exported = run_command(
            ["uv", "export", "--no-hashes", "--no-emit-project"], cwd=str(agent_dir)
        )

        requirements = []
        for line in exported.splitlines():
            if line.startswith(EXCLUDED_FROM_LAMBDA):
                print(f"Excluding from Lambda: {line}")
                continue
            requirements.append(line)

        (temp_path / "requirements.txt").write_text("\n".join(requirements))

        # The shared packages are path dependencies, so uv export omits them.
        # Mount and install each one explicitly.
        mounts = []
        installs = ["pip install --target ./package -r requirements.txt"]
        for name in SHARED_PACKAGES:
            source = backend_dir / name
            if not source.exists():
                print(f"Error: shared package not found: {source}")
                sys.exit(1)
            mounts += ["-v", f"{source}:/{name}"]
            installs.append(f"pip install --target ./package --no-deps /{name}")

        run_command(
            [
                "docker", "run", "--rm",
                "--platform", "linux/amd64",
                "-v", f"{temp_path}:/build",
                *mounts,
                "--entrypoint", "/bin/bash",
                "public.ecr.aws/lambda/python:3.12",
                "-c",
                "cd /build && " + " && ".join(installs),
            ]
        )

        modules = runtime_modules(agent_dir)
        print(f"Copying {len(modules)} module(s): {', '.join(m.name for m in modules)}")
        for module in modules:
            shutil.copy(module, package_dir)

        zip_path = agent_dir / f"{agent}_lambda.zip"
        if zip_path.exists():
            zip_path.unlink()

        # Python's zipfile rather than the zip CLI, which Windows lacks.
        print(f"Creating zip file: {zip_path}")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file in package_dir.rglob("*"):
                if file.is_file():
                    zf.write(file, file.relative_to(package_dir))

        size_mb = zip_path.stat().st_size / (1024 * 1024)
        print(f"Package created: {zip_path} ({size_mb:.1f} MB)")
        return zip_path


def deploy_lambda(zip_path: Path, function_name: str):
    """Push the built zip to an existing Lambda function."""
    import boto3

    lambda_client = boto3.client("lambda")
    print(f"Deploying to Lambda function: {function_name}")

    try:
        with open(zip_path, "rb") as f:
            response = lambda_client.update_function_code(
                FunctionName=function_name, ZipFile=f.read()
            )
        print(f"Successfully updated Lambda function: {function_name}")
        print(f"Function ARN: {response['FunctionArn']}")
    except lambda_client.exceptions.ResourceNotFoundException:
        print(f"Lambda function {function_name} not found. Deploy via Terraform first.")
        sys.exit(1)
    except Exception as e:
        print(f"Error deploying Lambda: {e}")
        sys.exit(1)


def main(agent_dir: Path, function_name: str = None):
    """Entry point for an agent's package_docker.py wrapper."""
    agent_dir = Path(agent_dir).resolve()
    function_name = function_name or f"rash-{agent_dir.name}"

    parser = argparse.ArgumentParser(
        description=f"Package the {agent_dir.name} Lambda for deployment"
    )
    parser.add_argument(
        "--deploy", action="store_true", help="Deploy to AWS after packaging"
    )
    args = parser.parse_args()

    # Docker not running is by far the most common failure here, and the error
    # it produces otherwise is misleading.
    try:
        run_command(["docker", "--version"])
    except FileNotFoundError:
        print("Error: Docker is not installed or not in PATH")
        sys.exit(1)

    zip_path = package_lambda(agent_dir)

    if args.deploy:
        deploy_lambda(zip_path, function_name)
