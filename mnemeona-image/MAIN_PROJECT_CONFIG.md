# Main-project configuration

The modular image backend can read its provider settings from the main
Mnemeona project instead of keeping them inside `mnemeona-image`.

Example layout:

```text
mnemeona/
├── config/
│   └── image-ai.json
└── mnemeona-image/
```

Start the image service with:

```bash
export MNEMEONA_IMAGE_CONFIG=/absolute/path/to/mnemeona/config/image-ai.json
./mnemeona-image/run.sh
```

On Windows PowerShell:

```powershell
$env:MNEMEONA_IMAGE_CONFIG="C:\path\to\mnemeona\config\image-ai.json"
.\mnemeona-image\run.sh
```

The frontend does not need to know which provider is active. It can call
`/providers` to display the installed providers and active provider, and
`/generate` stays provider-neutral.
