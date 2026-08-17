#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
    echo "Run this script with Bash."
    exit 1
fi

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/venv/bin/activate"

export PYTHONUNBUFFERED=1

cd "${SCRIPT_DIR}"

python -m uvicorn \
    app:app \
    --host 127.0.0.1 \
    --port 8199
