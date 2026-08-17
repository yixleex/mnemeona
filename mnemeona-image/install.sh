#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
    echo "ERROR: Run this installer with Bash:"
    echo
    echo "  bash install.sh"
    echo
    exit 1
fi

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/venv"
MODEL_DIR="${SCRIPT_DIR}/models/LCM_Dreamshaper_v7"

echo
echo "============================================================"
echo "       Mnemeona LCM DreamShaper v7 Installer"
echo "============================================================"
echo

if ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "ERROR: nvidia-smi was not found."
    echo
    echo "Please install/configure your NVIDIA driver first."
    exit 1
fi

echo "GPU:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo

if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 is required."
    exit 1
fi

echo "Python:"
python3 --version
echo

if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)'; then
    echo "ERROR: Python 3.11 or newer is required."
    exit 1
fi

if ! python3 -c 'import venv' >/dev/null 2>&1; then
    echo "ERROR: python3-venv is missing."
    echo
    echo "On Debian:"
    echo
    echo "  sudo apt install python3-venv"
    exit 1
fi

echo "Creating virtual environment..."

if [ ! -d "${VENV_DIR}" ]; then
    python3 -m venv "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"

python -m pip install --upgrade \
    pip \
    setuptools \
    wheel

echo
echo "============================================================"
echo "Installing PyTorch CUDA"
echo "============================================================"
echo

python -m pip install \
    torch \
    torchvision \
    torchaudio \
    --index-url https://download.pytorch.org/whl/cu128

echo
echo "Checking CUDA..."
echo

python - <<'PY'
import torch

print("PyTorch:", torch.__version__)
print("CUDA build:", torch.version.cuda)
print("CUDA available:", torch.cuda.is_available())

if not torch.cuda.is_available():
    raise SystemExit(
        "ERROR: PyTorch cannot access your NVIDIA GPU."
    )

print("GPU:", torch.cuda.get_device_name(0))

props = torch.cuda.get_device_properties(0)

print(
    "VRAM:",
    round(
        props.total_memory / 1024**3,
        2,
    ),
    "GB",
)
PY

echo
echo "============================================================"
echo "Installing Python dependencies"
echo "============================================================"
echo

python -m pip install \
    -r "${SCRIPT_DIR}/requirements.txt"

echo
echo "============================================================"
echo "Downloading LCM DreamShaper v7"
echo "============================================================"
echo

mkdir -p "${MODEL_DIR}"

echo
echo "Model:"
echo "  SimianLuo/LCM_Dreamshaper_v7"
echo
echo "License:"
echo "  MIT"
echo
echo "No Hugging Face login is required for this public model."
echo

python - <<PY
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="SimianLuo/LCM_Dreamshaper_v7",
    local_dir="${MODEL_DIR}",
)
PY

echo
echo "============================================================"
echo "Installation complete"
echo "============================================================"
echo

echo "Virtual environment:"
echo "  ${VENV_DIR}"
echo

echo "Model:"
echo "  ${MODEL_DIR}"
echo

echo "Next:"
echo
echo "  ./test_lcm.py"
echo
