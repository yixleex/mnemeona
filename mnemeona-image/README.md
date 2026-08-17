# Mnemeona Image — Modular AI Backend

This is a **local, drop-in test version** of `mnemeona-image` redesigned around pluggable image providers.

Nothing in GitHub is changed.

## What changed

The image service no longer hard-codes one image engine.

```text
mnemeona-image/
├── app.py
├── config/
│   └── image-ai.example.json
├── core/
│   ├── config.py
│   ├── gpu.py
│   ├── models.py
│   └── registry.py
├── providers/
│   ├── base.py
│   └── lcm/
│       ├── manifest.json
│       ├── provider.py
│       └── requirements.txt
├── install_provider.sh
├── install.sh
└── run.sh
```

A provider is an isolated adapter. The API talks only to the provider interface.

### Provider lifecycle

```text
Main Mnemeona app
       │
       ▼
/generate
       │
       ▼
Provider Registry
       │
       ├── LCM DreamShaper
       ├── ComfyUI adapter (add later)
       ├── Stable Diffusion adapter (add later)
       └── Your own provider
```

## Configure the active AI from the main project

The service reads its configuration from:

```bash
MNEMEONA_IMAGE_CONFIG=/path/to/mnemeona/config/image-ai.json
```

If that variable is not set, it uses:

```text
mnemeona-image/config/image-ai.json
```

Example:

```json
{
  "active_provider": "lcm",
  "providers": {
    "lcm": {
      "enabled": true,
      "model_path": "./mnemeona-image/models/LCM_Dreamshaper_v7",
      "device": "auto",
      "dtype": "float16",
      "settings": {
        "guidance_scale": 8.0,
        "lcm_origin_steps": 50,
        "attention_slicing": true,
        "vae_slicing": true,
        "vae_tiling": true
      }
    }
  },
  "gpu_coordination": {
    "enabled": true,
    "ollama_url": "http://127.0.0.1:11434",
    "reload_after_image": true,
    "timeout_seconds": 10
  }
}
```

The important part is that **the main Mnemeona project owns this configuration**. You can switch providers without changing the frontend API.

## Switching providers

Change:

```json
"active_provider": "lcm"
```

to another installed provider ID.

The backend exposes:

- `GET /providers`
- `GET /config`
- `GET /health`
- `GET /status`
- `GET /gpu-status`
- `POST /generate`

`POST /generate` keeps the same basic request shape:

```json
{
  "prompt": "a character portrait in a dark fantasy library",
  "width": 768,
  "height": 768,
  "steps": 4,
  "seed": 123
}
```

Provider-specific settings live under that provider's config.

## Adding another AI

Create:

```text
providers/my_ai/
├── manifest.json
├── provider.py
└── requirements.txt
```

`manifest.json`:

```json
{
  "id": "my_ai",
  "name": "My Image AI",
  "version": "1.0.0",
  "type": "local",
  "module": "provider:MyAIProvider",
  "requirements": "requirements.txt"
}
```

`provider.py` implements `ImageProvider`:

```python
from providers.base import ImageProvider, GenerationRequest, GenerationResult

class MyAIProvider(ImageProvider):
    def __init__(self, config):
        self.config = config

    @property
    def id(self):
        return "my_ai"

    @property
    def name(self):
        return "My Image AI"

    def status(self):
        return {"loaded": False}

    def generate(self, request):
        # Generate a PIL Image here.
        ...
```

The provider is discovered automatically.

### Provider-specific dependencies

Install only the provider you want:

```bash
./install_provider.sh lcm
```

or:

```bash
./install_provider.sh my_ai
```

This lets you test different image AIs without forcing every AI's dependencies into one Python environment.

## GPU / Ollama coordination

The existing Ollama VRAM coordination remains, but it is now independent of the image provider.

Before image generation:

1. Detect loaded Ollama models.
2. Evict them with `keep_alive=0`.
3. Generate the image.
4. Unload the image provider.
5. Optionally preload the previous Ollama models.

Disable it from the main config if desired:

```json
"gpu_coordination": {
  "enabled": false
}
```

This is especially useful while comparing image providers on a smaller GPU.

## Local testing

Replace your local `mnemeona-image` directory with this directory, or copy the contents over it.

Then:

```bash
./install.sh
```

For the existing LCM provider:

```bash
./install_provider.sh lcm
```

Run:

```bash
./run.sh
```

The API is normally available at:

```text
http://127.0.0.1:8000
```

Check:

```text
GET /providers
```

You should see the installed providers and which one is active.

## Important

This archive is deliberately a **local test implementation**. It does not modify, commit, push, or create a PR on GitHub.
