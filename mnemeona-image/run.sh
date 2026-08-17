#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
    echo "Run this script with Bash."
    exit 1
fi

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/venv/bin/activate"

export PYTHONUNBUFFERED=1

# PyTorch allocator setting helps reduce fragmentation when
# other CUDA workloads have recently used the GPU.
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"

# Ollama normally runs at this address. Override if necessary:
# export MNEMEONA_OLLAMA_URL=http://127.0.0.1:11434
#
# Disable automatic Story AI VRAM coordination with:
# export MNEMEONA_OLLAMA_GPU_COORDINATION=false
#
# By default the Story AI is automatically preloaded again after
# image generation. Set this to false if you want to keep the
# GPU free for several consecutive image generations:
# export MNEMEONA_OLLAMA_RELOAD_AFTER_IMAGE=false

cd "${SCRIPT_DIR}"

python -m uvicorn \
    app:app \
    --host 127.0.0.1 \
    --port 8199
