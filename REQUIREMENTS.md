# Mnemeona Development Requirements

This document describes the software and system dependencies required to develop, run, and build Mnemeona as both a web application and a native desktop application.

## 1. Project Overview

Mnemeona is a React/TypeScript application that can run in two modes:

### Web application

```text
React + Vite
     ↓
   Browser
```

### Desktop application

```text
React + Vite
     ↓
   Tauri 2
     ↓
Native desktop application
```

The same React frontend is used for both versions.

The web application does not require Tauri or Rust.

The desktop application requires the Tauri/Rust toolchain and the native system dependencies appropriate for the operating system.

---

## 2. Core Development Requirements

Mnemeona currently uses:

- Node.js
- npm
- React
- TypeScript
- Vite
- Tailwind CSS
- Tauri 2
- Rust
- Cargo
- Git

Optional:

- Ollama for local AI functionality

---

## 3. Node.js

Install a current Node.js LTS release.

Recommended:

- Node.js 22 LTS or newer LTS release
- npm 10 or newer

Check the installed versions:

```bash
node --version
npm --version
```

After cloning Mnemeona, install the JavaScript dependencies:

```bash
npm install
```

Do not commit `node_modules/` to Git.

---

## 4. Rust

The Tauri desktop application requires Rust and Cargo.

The recommended installation method is `rustup`.

Install Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation:

```bash
source "$HOME/.cargo/env"
```

Verify:

```bash
rustc --version
cargo --version
```

Mnemeona should use the stable Rust toolchain:

```bash
rustup default stable
```

---

## 5. Tauri

Mnemeona uses Tauri 2 for the native desktop application.

The Tauri CLI is installed through the project's npm development dependencies.

After cloning:

```bash
npm install
```

Check the Tauri version:

```bash
npx tauri --version
```

A global Tauri CLI installation is not required.

---

## 6. Debian / Ubuntu Linux Requirements

Install the native dependencies required by Tauri:

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

These provide the native libraries and build tools required by Tauri's Linux WebKit-based runtime and application bundling.

---

## 7. Linux Verification

```bash
node --version
npm --version
rustc --version
cargo --version
npx tauri --version
git --version
```

Every command should return a version number.

---

## 8. Clone Mnemeona

```bash
git clone https://github.com/yixleex/mnemeona.git
cd mnemeona
npm install
```

---

## 9. Run Mnemeona as a Web Application

```bash
npm run dev
```

Vite will normally make Mnemeona available at:

```text
http://localhost:1420/
```

Open that address in a browser.

---

## 10. Run Mnemeona as a Desktop Application

```bash
npm run tauri:dev
```

This starts Vite, compiles the Tauri application if necessary, and opens Mnemeona in a native desktop window.

---

## 11. Build the Web Application

```bash
npm run build
```

The production web build is placed in:

```text
dist/
```

Preview it with:

```bash
npm run preview
```

---

## 12. Build the Desktop Application

```bash
npm run tauri:build
```

Linux bundles are placed under:

```text
tauri/target/release/bundle/
```

Depending on the configured targets, this may contain:

```text
deb/
appimage/
```

---

## 13. Development Commands

| Command | Description |
|---|---|
| `npm install` | Install JavaScript dependencies |
| `npm run dev` | Start the web development server |
| `npm run build` | Build the web application |
| `npm run preview` | Preview the production web build |
| `npm run lint` | Run the project's linter |
| `npm run tauri:dev` | Start the native desktop application |
| `npm run tauri:build` | Build the native desktop application |
| `npx tauri --version` | Display the installed Tauri CLI version |

---

## 14. Project Structure

```text
mnemeona/
│
├── src/
│   └── React application
│
├── public/
│   └── Static assets
│
├── tauri/
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   │   └── Application icons
│   ├── src/
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── build.rs
│   └── tauri.conf.json
│
├── package.json
├── package-lock.json
├── vite.config.ts
├── index.html
└── REQUIREMENTS.md
```

---

## 15. Generated Files and Directories

Do not commit:

```text
node_modules/
dist/
tauri/target/
tauri/gen/
```

These are recreated automatically.

---

## 16. Files That Should Be Committed

Commit:

```text
package.json
package-lock.json

vite.config.ts
index.html

tauri/Cargo.toml
tauri/Cargo.lock
tauri/build.rs
tauri/tauri.conf.json

tauri/src/
tauri/capabilities/
tauri/icons/
```

Keep both dependency lock files:

```text
package-lock.json
tauri/Cargo.lock
```

They help provide reproducible builds.

---

## 17. Application Icons

Mnemeona's Tauri icons are stored in:

```text
tauri/icons/
```

These are source files and should be committed.

Do not add `tauri/icons/` to `.gitignore`.

---

## 18. Ollama

Ollama is optional and is not required to compile or run basic Mnemeona.

For local AI functionality:

```bash
ollama --version
```

Install the required models separately through Ollama.

Mnemeona should remain capable of running without Ollama.

---

## 19. Fresh Debian Machine Setup

### Install system dependencies

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

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### Verify Rust

```bash
rustc --version
cargo --version
```

### Install Node.js

Install a current Node.js LTS release, then verify:

```bash
node --version
npm --version
```

### Clone Mnemeona

```bash
git clone https://github.com/yixleex/mnemeona.git
cd mnemeona
npm install
```

### Run desktop version

```bash
npm run tauri:dev
```

### Build desktop version

```bash
npm run tauri:build
```

---

## 20. Troubleshooting

### Tauri cannot find WebKitGTK

If Cargo reports:

```text
Package 'webkit2gtk-4.1' was not found
```

install:

```bash
sudo apt install libwebkit2gtk-4.1-dev
```

### Tauri cannot find JavaScriptCoreGTK

If Cargo reports:

```text
Package 'javascriptcoregtk-4.1' was not found
```

install:

```bash
sudo apt install libjavascriptcoregtk-4.1-dev
```

### Check Debian package availability

```bash
apt-cache policy PACKAGE_NAME
```

For example:

```bash
apt-cache policy libjavascriptcoregtk-4.1-dev
```

Search:

```bash
apt-cache search javascriptcore
```

### Rust is not found

```bash
source "$HOME/.cargo/env"
```

Restart the terminal afterward if necessary.

### npm dependencies are missing

```bash
npm install
```

If necessary:

```bash
rm -rf node_modules
npm install
```

Do not remove `package-lock.json` unless intentionally regenerating it.

### Tauri dependencies need rebuilding

```bash
cd tauri
cargo clean
cd ..
npm run tauri:dev
```

### Tauri cannot find an application icon

Make sure:

```text
tauri/icons/
```

exists and contains the tracked Mnemeona icon files.

---

## 21. Web and Desktop Compatibility

### Web

```text
React
  ↓
Vite
  ↓
Browser
```

Run:

```bash
npm run dev
```

The web application does not require Rust or Tauri.

### Desktop

```text
React
  ↓
Vite
  ↓
Tauri
  ↓
Native application
```

Run:

```bash
npm run tauri:dev
```

Both versions use the same React frontend.

---

## 22. Future Native Features

The Tauri layer is intentionally small at this stage.

Future desktop-specific functionality may include:

- Native file dialogs
- Open Project
- Save Project
- Import/export
- Recent projects
- Native filesystem access
- Native notifications
- Application menus
- Keyboard shortcuts
- Window controls
- Desktop-specific settings
- Local Ollama integration
- Application auto-updates

Desktop-specific functionality should be implemented through Tauri without breaking the web application.

---

## 23. Privacy

Mnemeona is designed to support local-first and privacy-friendly workflows.

The desktop application does not inherently require a cloud backend.

Local AI functionality can be provided through Ollama.

Installing Tauri does not itself require Mnemeona's story or character data to be sent to a remote service.

Individual application features may have their own network requirements and should be documented separately when introduced.

---

## 24. Recommended Development Environment

For Linux development:

- Debian Linux
- Node.js LTS
- npm
- Rust stable
- Cargo
- Tauri 2
- Git
- Chromium or Firefox
- Optional: Ollama

---

## 25. Quick Start

For an already configured machine:

```bash
git clone https://github.com/yixleex/mnemeona.git
cd mnemeona
npm install
npm run tauri:dev
```

For the web application:

```bash
git clone https://github.com/yixleex/mnemeona.git
cd mnemeona
npm install
npm run dev
```

For a production desktop build:

```bash
npm install
npm run tauri:build
```

---

## 26. Summary

A fresh Debian machine needs:

### Required for web development

```text
Git
Node.js
npm
```

### Required for desktop development

```text
Git
Node.js
npm
Rust
Cargo
Tauri CLI
Debian Tauri system dependencies
```

### Optional

```text
Ollama
```

The web application remains independently usable, while Tauri provides the native desktop version.
