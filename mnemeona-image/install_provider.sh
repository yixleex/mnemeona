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

        python -m pip install \
            "huggingface_hub>=0.32"

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
print("LCM model download complete.")
print(f"Model location: {model_dir}")
PY
        fi

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


    ssd_1b)
        MODEL_DIR="${MODELS_DIR}/SSD-1B"
        MODEL_REPO="segmind/SSD-1B"

        echo
        echo "=========================================="
        echo " Installing Segmind SSD-1B"
        echo "=========================================="
        echo
        echo "Hugging Face repository:"
        echo "  ${MODEL_REPO}"
        echo
        echo "Local installation directory:"
        echo "  ${MODEL_DIR}"
        echo
        echo "License:"
        echo "  Apache 2.0"
        echo
        echo "Only the Diffusers model files required"
        echo "by Mnemeona will be downloaded."
        echo

        mkdir -p "${MODELS_DIR}"

        python -m pip install \
            "huggingface_hub>=0.32"

        if [ -f "${MODEL_DIR}/model_index.json" ]; then
            echo "SSD-1B model already exists."
            echo
            echo "Skipping download."
            echo
        else
            echo "Downloading SSD-1B..."
            echo
            echo "This may take several minutes."
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
    allow_patterns=[
        "model_index.json",
        "scheduler/*",
        "text_encoder/*",
        "text_encoder_2/*",
        "tokenizer/*",
        "tokenizer_2/*",
        "unet/*",
        "vae/*",
    ],
)

print()
print("SSD-1B model download complete.")
print(f"Model location: {model_dir}")
PY
        fi

        if [ ! -f "${MODEL_DIR}/model_index.json" ]; then
            echo
            echo "ERROR: SSD-1B installation appears incomplete."
            echo
            echo "Expected:"
            echo "  ${MODEL_DIR}/model_index.json"
            echo
            exit 1
        fi

        echo
        echo "SSD-1B model verified:"
        echo "  ${MODEL_DIR}"
        ;;


    sdxl_dreamshaper)
        MODEL_DIR="${MODELS_DIR}/DreamShaper_XL"
        MODEL_REPO="Lykon/dreamshaper-xl-1-0"

        echo
        echo "=========================================="
        echo " Installing DreamShaper XL"
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
        # Make sure huggingface_hub is available
        # even if provider requirements change.
        #

        python -m pip install \
            "huggingface_hub>=0.32"

        #
        # Check whether a usable Diffusers model
        # already exists.
        #

        if [ -f "${MODEL_DIR}/model_index.json" ]; then
            echo "DreamShaper XL model already exists."
            echo
            echo "Skipping download."
            echo
        else
            echo "Downloading DreamShaper XL..."
            echo
            echo "This model is large and may take some time."
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
print("DreamShaper XL download complete.")
print(f"Model location: {model_dir}")
PY
        fi

        #
        # Verify the installation.
        #

        if [ ! -f "${MODEL_DIR}/model_index.json" ]; then
            echo
            echo "ERROR: DreamShaper XL installation appears incomplete."
            echo
            echo "Expected:"
            echo "  ${MODEL_DIR}/model_index.json"
            echo
            exit 1
        fi

        echo
        echo "DreamShaper XL model verified:"
        echo "  ${MODEL_DIR}"
        ;;

    animagine_xl)
        MODEL_DIR="${MODELS_DIR}/Animagine-XL-3.1"
        MODEL_REPO="cagliostrolab/animagine-xl-3.1"

        echo
        echo "=========================================="
        echo " Installing Animagine XL 3.1"
        echo "=========================================="
        echo
        echo "Hugging Face repository:"
        echo "  ${MODEL_REPO}"
        echo
        echo "Local installation directory:"
        echo "  ${MODEL_DIR}"
        echo
        echo "License:"
        echo "  CreativeML Open RAIL++-M"
        echo
        echo "Downloading the Diffusers model..."
        echo

        mkdir -p "${MODELS_DIR}"

        python -m pip install \
            "huggingface_hub>=0.32"

        if [ -f "${MODEL_DIR}/model_index.json" ]; then
            echo "Animagine XL 3.1 model already exists."
            echo
            echo "Skipping download."
            echo
        else
            echo "Downloading Animagine XL 3.1..."
            echo
            echo "This model is large and may take some time."
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
print("Animagine XL 3.1 download complete.")
print(f"Model location: {model_dir}")
PY
        fi

        if [ ! -f "${MODEL_DIR}/model_index.json" ]; then
            echo
            echo "ERROR: Animagine XL 3.1 installation appears incomplete."
            echo
            echo "Expected:"
            echo "  ${MODEL_DIR}/model_index.json"
            echo
            exit 1
        fi

        echo
        echo "Animagine XL 3.1 model verified:"
        echo "  ${MODEL_DIR}"
        ;;

    sdxl_lightning)
        MODEL_DIR="${MODELS_DIR}/SDXL-Lightning"
        MODEL_REPO="ByteDance/SDXL-Lightning"

        echo
        echo "=========================================="
        echo " Installing SDXL-Lightning 4-Step"
        echo "=========================================="
        echo
        echo "Hugging Face repository:"
        echo "  ${MODEL_REPO}"
        echo
        echo "Local installation directory:"
        echo "  ${MODEL_DIR}"
        echo
        echo "License:"
        echo "  CreativeML Open RAIL++-M"
        echo
        echo "This provider uses the 4-step UNet"
        echo "checkpoint with the official SDXL base."
        echo
        echo "The Lightning checkpoint is about 5 GB."
        echo "The SDXL base model will also be cached"
        echo "by Diffusers on first use."
        echo

        mkdir -p "${MODEL_DIR}"

        python -m pip install \
            "huggingface_hub>=0.32"

        CHECKPOINT="${MODEL_DIR}/sdxl_lightning_4step_unet.safetensors"

        if [ -f "${CHECKPOINT}" ]; then
            echo "SDXL-Lightning 4-step checkpoint already exists."
            echo
            echo "Skipping download."
            echo
        else
            echo "Downloading SDXL-Lightning 4-step UNet..."
            echo
            echo "This is a large download and may take some time."
            echo

            python - <<PY
from pathlib import Path

from huggingface_hub import hf_hub_download

model_dir = Path(
    r"""${MODEL_DIR}"""
)

model_dir.mkdir(
    parents=True,
    exist_ok=True,
)

downloaded = hf_hub_download(
    repo_id="${MODEL_REPO}",
    filename="sdxl_lightning_4step_unet.safetensors",
    local_dir=str(model_dir),
)

print()
print("SDXL-Lightning checkpoint download complete.")
print(f"Model location: {downloaded}")
PY
        fi

        if [ ! -f "${CHECKPOINT}" ]; then
            echo
            echo "ERROR: SDXL-Lightning installation appears incomplete."
            echo
            echo "Expected:"
            echo "  ${CHECKPOINT}"
            echo
            exit 1
        fi

        echo
        echo "SDXL-Lightning model verified:"
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
