# Mnemeona

**Mnemeona** is a local-first writing and story-development environment for creating, organizing, and expanding long-form fiction.

It combines a manuscript editor, project and scene management, worldbuilding, and AI-assisted writing in one workspace.

## ✨ Features

* 📖 **Manuscript Editor** — Rich-text editing powered by Tiptap.
* 🗂️ **Project & Scene Management** — Organize novels into projects, chapters, and scenes.
* 🤖 **AI-Assisted Writing** — Generate continuations and work with context-aware story assistance.
* 🧠 **Story Summaries** — Maintain efficient summaries for long-term AI context.
* 🌎 **Worldbuilding** — Keep characters, locations, organizations, lore, and notes alongside the manuscript.
* ⚙️ **Local AI** — Configure a local AI endpoint, model, and API key.
* 💾 **Persistence** — Projects and manuscript state are saved locally.

## 🚀 Getting Started

### Requirements

* Node.js
* npm, pnpm, or another compatible package manager
* A modern web browser

### Installation

```bash
git clone https://github.com/yixleex/mnemeona.git
cd mnemeona
npm install
npm run dev
```

Open the local development URL provided by Vite.

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


## 📄 License

Mnemeona is open source software licensed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for the complete license text.

## 💡 Status

Mnemeona is an active development project. The long-term goal is a complete writing environment where **manuscript, story structure, worldbuilding, and AI assistance exist together in one coherent workspace**.
