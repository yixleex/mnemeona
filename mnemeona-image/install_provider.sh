#!/usr/bin/env bash
set -Eeuo pipefail

if [ -z "${BASH_VERSION:-}" ]; then
    echo "Run this script with Bash:"
    echo "  bash install_provider.sh <provider>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVIDER="${1:-}"

VENV_DIR="${SCRIPT_DIR}/venv"
PROVIDERS_DIR="${SCRIPT_DIR}/providers"
MODELS_DIR="${SCRIPT_DIR}/models"

if [ -z "${PROVIDER}" ]; then
    echo "Usage:"
    echo "  ./install_provider.sh <provider>"
    echo
    echo "Available providers:"

    find "${PROVIDERS_DIR}" \
        -mindepth 2 \
        -maxdepth 2 \
        -name manifest.json \
        -printf "  %h\n" \
        2>/dev/null \
        | sed "s#${PROVIDERS_DIR}/##" \
        || true

    exit 1
fi

if [ ! -d "${VENV_DIR}" ]; then
    echo "ERROR: Python virtual environment does not exist."
    echo
    echo "Run:"
    echo "  ./install.sh"
    echo
    exit 1
fi

PROVIDER_DIR="${PROVIDERS_DIR}/${PROVIDER}"
REQUIREMENTS="${PROVIDER_DIR}/requirements.txt"

if [ ! -d "${PROVIDER_DIR}" ]; then
    echo "ERROR: Provider does not exist:"
    echo "  ${PROVIDER}"
    exit 1
fi

if [ ! -f "${REQUIREMENTS}" ]; then
    echo "ERROR: No provider requirements file found:"
    echo "  ${REQUIREMENTS}"
    exit 1
fi

source "${VENV_DIR}/bin/activate"

echo
echo "=========================================="
echo " Installing image provider: ${PROVIDER}"
echo "=========================================="
echo

echo "Installing provider Python dependencies..."

python -m pip install \
    -r "${REQUIREMENTS}"

echo
echo "Provider dependencies installed."

#
# Provider-specific model installation
#

case "${PROVIDER}" in

    lcm)

        MODEL_DIR="${MODELS_DIR}/LCM_Dreamshaper_v7"
        MODEL_REPO="SimianLuo/LCM_Dreamshaper_v7"

        echo
        echo "=========================================="
        echo " Installing LCM DreamShaper v7"
        echo "=========================================="
        echo
        echo "Hugging Face repository:"
        echo "  ${MODEL_REPO}"
        echo
        echo "Local installation directory:"
        echo "  ${MODEL_DIR}"
        echo

        mkdir -p "${MODELS_DIR}"

        #
        # Install huggingface_hub explicitly.
        #

        python -m pip install \
            "huggingface_hub>=0.32"

        #
        # Check whether a usable Diffusers model
        # already exists.
        #

        if [ -f "${MODEL_DIR}/model_index.json" ]; then
            echo "LCM model already exists."
            echo
            echo "Skipping download."
            echo
        else
            echo "Downloading LCM DreamShaper v7..."
            echo
            echo "This model is large and may take some time."
            echo

            python - <<PY
from pathlib import Path

from huggingface_hub import snapshot_download

model_dir = Path(r"""${MODEL_DIR}""")

model_dir.mkdir(
    parents=True,
    exist_ok=True,
)

snapshot_download(
    repo_id="${MODEL_REPO}",
    local_dir=str(model_dir),
)

print()
print("LCM model download complete.")
print(f"Model location: {model_dir}")
PY
        fi

        #
        # Verify the installation.
        #

        if [ ! -f "${MODEL_DIR}/model_index.json" ]; then
            echo
            echo "ERROR: LCM model installation appears incomplete."
            echo
            echo "Expected:"
            echo "  ${MODEL_DIR}/model_index.json"
            echo
            exit 1
        fi

        echo
        echo "LCM model verified:"
        echo "  ${MODEL_DIR}"
        ;;

    sdxl_vega)

        MODEL_DIR="${MODELS_DIR}/Segmind-Vega"
        MODEL_REPO="segmind/Segmind-Vega"

        echo
        echo "=========================================="
        echo " Installing Segmind-Vega"
        echo "=========================================="
        echo
        echo "License:"
        echo "  Apache 2.0"
        echo
        echo "Hugging Face repository:"
        echo "  ${MODEL_REPO}"
        echo
        echo "Local installation directory:"
        echo "  ${MODEL_DIR}"
        echo

        mkdir -p "${MODELS_DIR}"

        #
        # Install huggingface_hub explicitly.
        #

        python -m pip install \
            "huggingface_hub>=0.32"

        #
        # Check whether a complete Diffusers
        # installation already exists.
        #

        if [ -f "${MODEL_DIR}/model_index.json" ]; then

            echo "Segmind-Vega model already exists."
            echo
            echo "Skipping download."
            echo

        else

            echo "Downloading Segmind-Vega..."
            echo
            echo "This model is several GB."
            echo "The files will be stored locally."
            echo

            python - <<PY
from pathlib import Path

from huggingface_hub import snapshot_download

model_dir = Path(
    r"""${MODEL_DIR}"""
)

model_dir.mkdir(
    parents=True,
    exist_ok=True,
)

snapshot_download(
    repo_id="${MODEL_REPO}",
    local_dir=str(model_dir),
)

print()
print("Segmind-Vega download complete.")
print(f"Model location: {model_dir}")
PY

        fi

        #
        # Verify the installation.
        #

        if [ ! -f "${MODEL_DIR}/model_index.json" ]; then
            echo
            echo "ERROR: Segmind-Vega installation appears incomplete."
            echo
            echo "Expected:"
            echo "  ${MODEL_DIR}/model_index.json"
            echo
            echo "The downloaded repository does not appear"
            echo "to contain a complete Diffusers pipeline."
            echo
            exit 1
        fi

        echo
        echo "Segmind-Vega model verified:"
        echo "  ${MODEL_DIR}"
        ;;

    *)

        echo
        echo "No automatic model downloader is configured"
        echo "for provider: ${PROVIDER}"
        echo
        echo "Provider dependencies were installed successfully."
        ;;

esac

echo
echo "=========================================="
echo " Provider installation complete"
echo "=========================================="
echo
echo "Provider:"
echo "  ${PROVIDER}"
echo
