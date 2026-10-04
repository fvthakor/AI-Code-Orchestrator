# AI Code Orchestrator — Windows V1

A local orchestration desktop application for Windows 10/11 x64 that manages, connects, and coordinates local AI coding CLIs (**Claude Code**, **OpenAI Codex CLI**, **OpenCode**, and **Antigravity (AGY)**) within local project directories.

Built with **Tauri v2**, **Rust**, **React**, **TypeScript**, **Tailwind CSS**, and authentic **Windows ConPTY** terminal streaming.

---

## Highlights & Features

- **Multi-Agent Adapter Architecture**: Modular `AgentAdapter` abstraction for Claude Code, Codex, OpenCode, and Antigravity, with automatic Windows PATH resolution (`.cmd`, `.bat`, `.exe`) and custom executable overrides.
- **Interactive ConPTY Streaming**: Real-time terminal sessions powered by `portable-pty` on Windows and `@xterm/xterm` in the frontend, supporting full bidirectional input, resize, and ANSI escape sequences.
- **Process Lifecycle & Tree Cleanup**: Uses Win32 Job Objects (`JOBOBJECT_EXTENDED_LIMIT_INFORMATION` with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`) to ensure no orphan/zombie child processes are left behind on Windows.
- **Deep Tech-Stack Detection**: Non-executing heuristic scanner detecting Git, Node.js (npm, yarn, pnpm), PHP (Composer, Laravel), Python (pip, poetry), Rust (Cargo), Go, Docker, React, Vue, Angular, Next.js, and databases.
- **Security Policy Engine**:
  - Path traversal defense: canonicalizes all file targets and rejects operations escaping project root or accessing sensitive files (`.env`, `.git/config`, `id_rsa`, etc.).
  - Command categorization: automatic classification into Safe, Low, Medium, High, and Blocked with user confirmation prompts.
- **Integrated Git Diff & Commit**: Real-time unified diff viewer with syntax highlighting and a one-click staging & commit interface.
- **Embedded Local Database**: Embedded SQLite (`rusqlite`) storing projects, tasks, execution logs, and settings locally in `%APPDATA%\com.ai.orchestrator.desktop\orchestrator.db`. No secrets or API keys are stored in plain SQLite.
- **Command Palette & Keyboard Shortcuts**:
  - `Ctrl+Shift+P`: Quick Command Palette
  - `Ctrl+Shift+T`: Create New AI Task
  - `Ctrl+\``: Toggle ConPTY Terminal Drawer
  - `Ctrl+O`: Open Local Project Directory
  - `Ctrl+R`: Rescan Active Project Metadata

---

## Architecture Overview

```
ai-code-orchestrator/
├── apps/
│   └── desktop/
│       ├── src/                      # React frontend
│       │   ├── components/           # UI primitives, TerminalView, GitDiffView, CommandPalette
│       │   ├── pages/                # Dashboard, Projects, Tasks, Agents, Changes, Executions, Settings
│       │   ├── layouts/              # AppLayout (Sidebar, Header, Drawer Terminal)
│       │   ├── stores/               # Zustand state stores
│       │   ├── hooks/                # Keyboard shortcuts & utilities
│       │   └── services/             # Typed Tauri IPC service bridge
│       │
│       └── src-tauri/                # Native Rust backend
│           ├── src/
│           │   ├── agents/           # AgentAdapter trait, Claude, Codex, OpenCode, Registry
│           │   ├── execution/        # ConPTY manager, Win32 Job Object, PTY session
│           │   ├── filesystem/       # PathGuard canonicalization & traversal protection
│           │   ├── project/          # Heuristic technology stack scanner & context
│           │   ├── git/              # Git CLI service & worktree management
│           │   ├── security/         # Policy rules, risk scoring, command sanitizer
│           │   ├── database/         # SQLite schema, migrations, connection pool
│           │   ├── commands/         # Tauri IPC command handlers
│           │   └── lib.rs            # Application entrypoint & state management
│           └── Cargo.toml
│
├── packages/
│   └── shared-types/                 # Shared TypeScript models and interfaces
│
└── docs/                             # Detailed architecture and developer documentation
    ├── architecture.md
    ├── agents.md
    ├── execution.md
    ├── security.md
    ├── git.md
    └── development.md
```

---

## Quick Start

### Prerequisites

- **Windows 10 / 11 (x64)**
- **Rust Toolchain**: `rustup default stable-x86_64-pc-windows-msvc`
- **Node.js**: `v18+` or `v20+`
- **pnpm**: `npm install -g pnpm`
- **Git for Windows** installed and available in `PATH`
- (Optional) AI Coding CLIs installed:
  - Claude Code: `npm install -g @anthropic-ai/claude-code`
  - Codex CLI: `npm install -g @openai/codex`
  - OpenCode: `npm install -g opencode`

### Installation & Build

```powershell
# Clone the repository
git clone https://github.com/fvthakor/AI-Code-Orchestrator.git
cd AI-Code-Orchestrator

# Install dependencies
pnpm install

# Build shared types package
pnpm --filter @ai-orchestrator/shared-types build

# Run backend integration tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml

# Run the Tauri application in dev mode
pnpm --filter desktop tauri dev

# Build production bundle (.msi / .exe)
pnpm --filter desktop tauri build
```

---

## Documentation

Detailed architectural and technical guides can be found in the [`docs/`](./docs) folder:

- [System Architecture](./docs/architecture.md)
- [Agent Adapter Framework](./docs/agents.md)
- [ConPTY & Process Management](./docs/execution.md)
- [Security Model & Path Guards](./docs/security.md)
- [Git Operations & Worktree Workflow](./docs/git.md)
- [Development & Testing Guide](./docs/development.md)

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
