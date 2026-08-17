#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/venv/bin/activate"

export PYTHONPATH="${SCRIPT_DIR}:${PYTHONPATH:-}"

exec uvicorn app:app \
    --host 127.0.0.1 \
    --port "${MNEMEONA_IMAGE_PORT:-8000}"
