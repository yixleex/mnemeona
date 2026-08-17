# Mnemeona GPU coordination patch

This patch makes `mnemeona-image` coordinate GPU VRAM with the Story AI running in Ollama.

## What it does

When `/generate` is called:

1. Mnemeona asks Ollama which models are currently loaded with `/api/ps`.
2. Each loaded model is unloaded using Ollama's `keep_alive: 0` API behavior.
3. The image model generates the requested image.
4. The image pipeline is unloaded and CUDA memory is released.
5. The Story AI models that were running before image generation are preloaded again.

Ollama itself is never stopped.

## Why this fixes the RTX 3060 problem

The Story AI can occupy most of the 12 GB GPU while idle because Ollama keeps models loaded for a period of time.

The image service therefore gets the GPU exclusively during image generation instead of trying to coexist with the Story model.

Ollama's API explicitly supports `keep_alive: 0` to unload a model immediately, and `/api/ps` reports the models currently loaded in memory.

## Files

Replace:

- `mnemeona-image/app.py`
- `mnemeona-image/lcm_engine.py`
- `mnemeona-image/run.sh`

Add:

- `mnemeona-image/ollama_manager.py`

`requirements.txt` does not need a new dependency because the Ollama coordinator uses Python's standard library HTTP client.

## Configuration

The defaults are:

```text
MNEMEONA_OLLAMA_GPU_COORDINATION=true
MNEMEONA_OLLAMA_URL=http://127.0.0.1:11434
MNEMEONA_OLLAMA_RELOAD_AFTER_IMAGE=true
MNEMEONA_OLLAMA_TIMEOUT=10
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

If Ollama uses its normal local port, no configuration is required.

## Consecutive image generations

If you want to generate several images in a row, set:

```text
MNEMEONA_OLLAMA_RELOAD_AFTER_IMAGE=false
```

That prevents the Story AI from being immediately loaded back into VRAM between images.

The Story AI will load normally again when Mnemeona sends the next Story AI request.

## Test

Start Ollama normally.

Then start the image service:

```bash
./run.sh
```

Check:

```text
http://127.0.0.1:8199/gpu-status
```

You should see the currently loaded Ollama models.

Then generate an image from Mnemeona.

Watch:

```bash
nvidia-smi
```

During image generation, the Story AI should disappear from GPU memory.

After generation, the image model is unloaded and the Story AI is preloaded again.

## Important

Do not run a Story AI generation at exactly the same time as starting image generation. The GPU handoff assumes the Story request is idle.

The next architectural improvement should be a shared Mnemeona AI resource manager so Story AI, Image AI, and future local models can acquire and release the GPU through one coordinator.
