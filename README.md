# Mnemeona

**Mnemeona** is a local-first writing and story-development environment for creating, organizing, and expanding long-form fiction.

It combines a manuscript editor, project and scene management, worldbuilding, AI-assisted writing, and visual story development in one workspace.

Mnemeona can run either as a **web application** or as a **native desktop application** using Tauri.

## ✨ Features

- 📖 **Manuscript Editor** — Rich-text editing powered by Tiptap.
- 🗂️ **Project & Scene Management** — Organize novels into projects, chapters, and scenes.
- 🤖 **AI-Assisted Writing** — Generate continuations and work with context-aware story assistance.
- 🧠 **Story Summaries & Context** — Maintain efficient summaries and structured context for long-term AI assistance.
- 👤 **Character Creation** — Develop character ideas through AI-assisted conversations and turn approved concepts into character profiles.
- 🌎 **Worldbuilding** — Keep characters, locations, organizations, world events, lore, and notes alongside the manuscript.
- 🔍 **Automatic Story Detection** — Detect relevant characters, locations, and world events from scenes to help keep story context up to date.
- ✍️ **AI Scene Tools** — Work with AI-generated content and insert useful results directly into scenes.
- 🖼️ **Images & Visual Storytelling** — Add images to your projects and use visual references alongside your writing.
- 🎨 **AI Image Generation** — Generate images from within Mnemeona using a configurable image-generation model.
- 🧩 **AI Context Panel** — Inspect the story context being supplied to the AI, including relevant characters, locations, and other project information.
- ⚙️ **Local AI** — Configure a local AI endpoint, text model, image-generation model, and API key as needed.
- 💾 **Local Persistence** — Projects and manuscript state are saved locally.
- 🌙 **Dark Mode** — Use Mnemeona comfortably in a dark interface.
- 📚 **Reading Mode** — Read your completed story as chapters without the editing interface.
- 🖥️ **Desktop App** — Run Mnemeona as a native Linux desktop application through Tauri.
- 🌐 **Web App** — Continue using Mnemeona directly in a modern web browser.

## 🚀 Getting Started

### Requirements

For the web version:

- Git
- Node.js 22+ LTS
- npm
- A modern web browser

For the desktop version, also install:

- Rust (stable)
- Cargo
- Tauri 2
- Debian/Ubuntu Tauri system dependencies

### Debian / Ubuntu

Install the native dependencies required to build the desktop application:

```bash
sudo apt update

sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  patchelf \
  git
```

Install Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### Installation

```bash
git clone https://github.com/yixleex/mnemeona.git
cd mnemeona
npm install
```

## 🌐 Run the Web App

```bash
npm run dev
```

Open the local development URL provided by Vite.

The web version does **not** require Rust or Tauri.

## 🖥️ Run the Desktop App

```bash
npm run tauri:dev
```

This starts Mnemeona in a native desktop window using Tauri.

## 📦 Build

### Web

```bash
npm run build
```

### Desktop

```bash
npm run tauri:build
```

Linux desktop bundles are created under:

```text
tauri/target/release/bundle/
```

## 🤖 AI

Mnemeona is designed around local AI providers and configurable AI services.

Configure your provider from the application's AI settings:

```text
Provider: local
Endpoint: <local AI endpoint>
Model: <text model name>
Image Model: <image-generation model name>
API Key: <optional API key>
```

AI context can include the current scene, previous scenes, summaries, detected characters, locations, world events, and other relevant project information.

### Ollama

Ollama is optional and is not required to build or run Mnemeona.

It can be used as a local AI provider for completely local text-generation workflows.

Check whether Ollama is installed:

```bash
ollama --version
```

## 🖼️ Images & AI Image Generation

Mnemeona supports using images as part of the writing and worldbuilding workflow.

Images can be associated with story content and used as visual references for characters, locations, scenes, and other creative material.

Mnemeona also supports **AI image generation** through a configurable image-generation model. This allows visual concepts to be created alongside the writing process rather than requiring a separate application.

The exact image-generation provider and model depend on the configuration available in your Mnemeona installation.

## 🧠 AI-Assisted Story Development

Mnemeona is intended to make AI useful throughout the writing workflow rather than treating it as a standalone chatbot.

AI-assisted features can help with:

- Continuing or expanding scenes
- Developing character concepts
- Creating approved character profiles
- Understanding current scene context
- Working with previous scenes and story summaries
- Detecting characters, locations, and world events
- Generating content that can be inserted into scenes
- Developing visual concepts with image generation

The goal is to keep AI assistance grounded in the project's actual manuscript and worldbuilding data.

## 🔒 Local-First & Privacy

Mnemeona is designed with local-first use in mind.

The application can run without a cloud backend, and local AI providers such as Ollama can be used for AI functionality.

When using a local AI provider, prompts and generated text can remain on the local machine rather than being sent to a third-party cloud AI service.

Image generation follows the provider and model configured by the user.

The desktop application uses Tauri to provide native functionality while keeping the same React frontend used by the web version.

## 🛠️ Technology

Mnemeona is built around:

- **React** for the application interface
- **TypeScript** for application logic
- **Tiptap** for rich-text manuscript editing
- **Tauri 2** for the native desktop application
- **Local AI providers** for privacy-friendly AI workflows
- **Configurable image-generation models** for visual story development

## 📄 License

Mnemeona is open source software licensed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for the complete license text.

## 💡 Status

Mnemeona is an active development project.

The long-term goal is a complete writing environment where **manuscript, story structure, worldbuilding, visual storytelling, and AI assistance exist together in one coherent workspace**.
