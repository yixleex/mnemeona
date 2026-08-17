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

echo
echo "=========================================="
echo " Mnemeona Image AI Installer"
echo "=========================================="
echo

#
# Python virtual environment
#

if [ ! -d "${VENV_DIR}" ]; then
    echo "Creating Python virtual environment..."

    python3 -m venv "${VENV_DIR}"
else
    echo "Python virtual environment already exists."
fi

source "${VENV_DIR}/bin/activate"

#
# Packaging tools
#

echo
echo "Updating Python packaging tools..."

python -m pip install \
    --upgrade \
    pip \
    setuptools \
    wheel

#
# PyTorch
#

echo
echo "=========================================="
echo " Installing PyTorch CUDA"
echo "=========================================="
echo

python -m pip install \
    torch \
    torchvision \
    torchaudio \
    --index-url https://download.pytorch.org/whl/cu128

#
# Core API
#

echo
echo "=========================================="
echo " Installing core API dependencies"
echo "=========================================="
echo

python -m pip install \
    "fastapi>=0.116" \
    "uvicorn[standard]>=0.35" \
    "pillow>=11.0" \
    "python-multipart>=0.0.20"

#
# Install the initial image provider.
#

echo
echo "=========================================="
echo " Installing LCM provider"
echo "=========================================="
echo

"${SCRIPT_DIR}/install_provider.sh" lcm

echo
echo "=========================================="
echo " Mnemeona Image installation complete"
echo "=========================================="
echo

echo "Image service:"
echo "  ${SCRIPT_DIR}"

echo
echo "Virtual environment:"
echo "  ${VENV_DIR}"

echo
echo "LCM model:"
echo "  ${SCRIPT_DIR}/models/LCM_Dreamshaper_v7"

echo
echo "Start the image server with:"
echo
echo "  source ${VENV_DIR}/bin/activate"
echo "  python ${SCRIPT_DIR}/app.py"
echo
