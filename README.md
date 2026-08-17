# Mnemeona

**Mnemeona** is a local-first writing and story-development environment for creating, organizing, and expanding long-form fiction.

It combines a manuscript editor, project and scene management, worldbuilding, and AI-assisted writing in one workspace.

Mnemeona can run either as a **web application** or as a **native desktop application** using Tauri.

## ✨ Features

- 📖 **Manuscript Editor** — Rich-text editing powered by Tiptap.
- 🗂️ **Project & Scene Management** — Organize novels into projects, chapters, and scenes.
- 🤖 **AI-Assisted Writing** — Generate continuations and work with context-aware story assistance.
- 🧠 **Story Summaries** — Maintain efficient summaries for long-term AI context.
- 🌎 **Worldbuilding** — Keep characters, locations, organizations, lore, and notes alongside the manuscript.
- ⚙️ **Local AI** — Configure a local AI endpoint, model, and API key.
- 💾 **Persistence** — Projects and manuscript state are saved locally.
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

Mnemeona is designed around local AI providers.

Configure your provider from the application's AI settings:

```text
Provider: local
Endpoint: <local AI endpoint>
Model: <model name>
API Key: <optional API key>
```

AI context can include the current scene, previous scenes, summaries, and other relevant project information.

### Ollama

Ollama is optional and is not required to build or run Mnemeona.

It can be used as a local AI provider for completely local AI workflows.

Check whether Ollama is installed:

```bash
ollama --version
```

## 🔒 Local-First

Mnemeona is designed with local-first use in mind.

The application can run without a cloud backend, and local AI providers such as Ollama can be used for AI functionality.

The desktop application uses Tauri to provide native functionality while keeping the same React frontend used by the web version.

## 📄 License

Mnemeona is open source software licensed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for the complete license text.

## 💡 Status

Mnemeona is an active development project.

The long-term goal is a complete writing environment where **manuscript, story structure, worldbuilding, and AI assistance exist together in one coherent workspace**.
