#!/usr/bin/env bash
set -Eeuo pipefail

if [ -z "${BASH_VERSION:-}" ]; then
    echo "Run this script with Bash: bash install_provider.sh <provider>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVIDER="${1:-}"

if [ -z "${PROVIDER}" ]; then
    echo "Usage: ./install_provider.sh <provider>"
    echo
    echo "Available providers:"
    find "${SCRIPT_DIR}/providers" -mindepth 2 -maxdepth 2 \
        -name manifest.json -printf "  %h\n" 2>/dev/null \
        | sed "s#${SCRIPT_DIR}/providers/##" \
        || true
    exit 1
fi

VENV_DIR="${SCRIPT_DIR}/venv"
REQUIREMENTS="${SCRIPT_DIR}/providers/${PROVIDER}/requirements.txt"

if [ ! -d "${VENV_DIR}" ]; then
    echo "ERROR: venv does not exist."
    echo "Run ./install.sh first."
    exit 1
fi

if [ ! -f "${REQUIREMENTS}" ]; then
    echo "No provider requirements file found for: ${PROVIDER}"
    exit 1
fi

source "${VENV_DIR}/bin/activate"

echo "Installing provider dependencies: ${PROVIDER}"
python -m pip install -r "${REQUIREMENTS}"

echo
echo "Provider installed: ${PROVIDER}"
