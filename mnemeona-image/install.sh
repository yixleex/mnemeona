#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/venv"

if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 is required."
    exit 1
fi

if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)'; then
    echo "ERROR: Python 3.11 or newer is required."
    exit 1
fi

if [ ! -d "${VENV_DIR}" ]; then
    python3 -m venv "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"

python -m pip install --upgrade pip setuptools wheel

echo
echo "Installing PyTorch CUDA..."
python -m pip install \
    torch \
    torchvision \
    torchaudio \
    --index-url https://download.pytorch.org/whl/cu128

echo
echo "Installing core API dependencies..."
python -m pip install \
    "fastapi>=0.116" \
    "uvicorn[standard]>=0.35" \
    "pillow>=11.0" \
    "python-multipart>=0.0.20"

echo
echo "Base installation complete."
echo
echo "Install the image AI you want:"
echo "  ./install_provider.sh lcm"
