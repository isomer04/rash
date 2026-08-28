#!/usr/bin/env python3
"""Package the Charter Lambda function.

The implementation is shared across all agents; see backend/lambda_packaging.py.
This wrapper exists so `uv run package_docker.py` keeps working from inside the
agent directory, and so backend/package_docker.py can fan out to it.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lambda_packaging import main

if __name__ == "__main__":
    main(agent_dir=Path(__file__).resolve().parent, function_name="rash-charter")
