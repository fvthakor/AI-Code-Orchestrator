# AI Code Orchestrator — Windows V1 Architecture & Design Specification

**Date:** 2026-10-04  
**Target Platform:** Windows 10 / Windows 11 (x64)  
**Status:** Approved  

---

## 1. Executive Summary

AI Code Orchestrator is a developer-focused Windows desktop application that acts as a local orchestration and management layer for AI coding CLIs (such as Claude Code, Codex CLI, and OpenCode). 

It empowers developers to:
1. Select an existing local repository.
2. Automatically analyze the project technology stack without executing project scripts.
3. Automatically detect installed AI coding CLI tools on Windows with their versions and capabilities.
4. Run AI coding tasks inside the project using authentic Windows Pseudo-Console (ConPTY) sessions.
5. Stream real-time terminal output to an embedded developer terminal with full ANSI color support and bidirectional interaction.
6. Track file modifications and inspect Git status and unified diffs.
7. Run manual build/test commands (e.g., `npm test`, `cargo check`) with live output.
8. Retain execution logs and metrics in an embedded SQLite database.
9. Enforce strict filesystem boundary validation and command execution security policies.
10. Establish a clean architecture and Git worktree abstraction for future multi-agent parallel workflows.

---

## 2. Technology Stack

### Desktop Core
- **Framework:** Tauri v2 (Rust)
- **Target OS:** Windows 10/11 x64
- **Process & PTY Engine:** `portable-pty` crate (native Windows ConPTY) + Win32 Job Objects for process tree management
- **Database:** `rusqlite` (bundled SQLite 3 engine) with automatic migrations
- **File Watching:** `notify` crate
- **Serialization & Async:** `serde`, `serde_json`, `tokio`, `uuid`, `chrono`

### Frontend Application
- **Framework:** React 18/19 with TypeScript (Strict mode)
- **Bundler:** Vite
- **Styling:** Tailwind CSS + Radix UI / custom shadcn-style component primitives
- **Icons:** `lucide-react`
- **Terminal UI:** `@xterm/xterm` with `@xterm/addon-fit`
- **State Management:** `zustand`
- **IPC Client:** `@tauri-apps/api`

---

## 3. Monorepo Repository Structure

```text
ai-code-orchestrator/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── components/         # Dashboard, Terminal, GitDiff, AgentCard, TaskModal, CommandBar
│       │   │   └── ui/             # Dialog, Button, Badge, Tabs, Card, Input, Toast
│       │   ├── pages/              # Projects, Dashboard, Agents, Tasks, Executions, Changes, Settings
│       │   ├── layouts/            # AppLayout, Sidebar, Topbar, StatusBar
│       │   ├── hooks/              # useKeyboardShortcuts, useTerminalSession, useProject
│       │   ├── stores/             # Zustand stores (useProjectStore, useAgentStore, useTaskStore, etc.)
│       │   ├── services/           # Typed Tauri IPC client wrappers
│       │   ├── types/              # Frontend TypeScript models
│       │   └── utils/              # ANSI utils, date formatters, shortcut helpers
│       │
│       └── src-tauri/
│           ├── src/
│           │   ├── agents/         # AgentAdapter trait, Claude, Codex, OpenCode adapters, registry
│           │   ├── commands/       # Tauri commands: project, agent, task, execution, terminal, git, security
│           │   ├── database/       # SQLite schema, migrations, queries
│           │   ├── execution/      # ConPTY ProcessManager, session tracking, process tree killer
│           │   ├── filesystem/     # Safe path validation, project tech scanner, file watcher
│           │   ├── git/            # Git CLI wrapper (status, diff, branch, log, commit, worktree foundation)
│           │   ├── project/        # Project context analyzer
│           │   ├── security/       # Command policy engine, sensitive directory blocklist, confirmation gate
│           │   ├── models/         # Rust data structures (Project, Agent, Task, Execution, Settings)
│           │   └── lib.rs / main.rs# Tauri application initialization & IPC registration
│           ├── Cargo.toml
│           └── tauri.conf.json
│
├── packages/
│   └── shared-types/               # Shared TypeScript schemas matching Rust models
├── docs/                           # Documentation: architecture, agents, execution, security, git, development
└── tests/                          # Integration test suites for Rust and Frontend
```

---

## 4. Subsystem Details

### 4.1 Process Manager & ConPTY (`src-tauri/src/execution/`)
- Uses `portable-pty` to spawn real Windows ConPTY sessions.
- Default shell is `powershell.exe -NoProfile -ExecutionPolicy Bypass`.
- Bidirectional data flow:
  - Rust reader thread asynchronously streams bytes to Tauri frontend via `terminal-output:{session_id}` events.
  - Frontend `@xterm/xterm` sends user input and resize events via `terminal_write` and `terminal_resize` commands.
- **Process Tree Cleanup:** On Windows, processes spawned in tasks are associated with a Win32 Job Object or terminated using tree kill (`taskkill /PID <pid> /T /F`) upon cancellation or exit, preventing orphaned or zombie processes.

### 4.2 Security & Safety Guard (`src-tauri/src/security/`)
- **Path Guard:** Every filesystem operation and process working directory is validated to be inside the selected project directory (`canonicalize` checked against project root).
- **Sensitive Path Guard:** Denies access to system folders (`C:\Windows`, `C:\Program Files`), user profile root, and sensitive subdirectories (`.ssh`, `.gnupg`, `.env*`, browser data).
- **Execution Policy:**
  - Whitelist: Standard developer tools (`git`, `npm`, `pnpm`, `yarn`, `node`, `cargo`, `go`, `composer`, `python`, `pip`, `docker`) and registered AI CLI executables.
  - Risk Filter: Blocks high-risk system commands (`format`, `diskpart`, `rmdir /s /q /`, registry modifications, `takeown`, shutdown, `runas`). Destructive operations require explicit user approval.

### 4.3 Agent Architecture & Detection (`src-tauri/src/agents/`)
- **`AgentAdapter` Trait:**
  - `id() -> &'static str`
  - `name() -> &'static str`
  - `description() -> &'static str`
  - `detect(custom_path) -> AgentDetectionResult`
  - `capabilities() -> AgentCapabilities`
  - `build_execution_command(...) -> Result<ExecutionCommand, AgentError>`
- **Adapters Implemented:**
  - `ClaudeAdapter`: Resolves `claude.cmd`, `claude.exe`, or custom path; safely checks version and user auth presence.
  - `CodexAdapter`: Resolves `codex.cmd`, `codex.exe`, or custom path; safely checks version and auth presence.
  - `OpenCodeAdapter`: Resolves `opencode.cmd`, `opencode.exe`, or custom path; safely checks version.
- **Windows Executable Resolution:** Scans custom paths, Windows `PATH` with `PATHEXT` (`.exe`, `.cmd`, `.bat`), npm global prefix (`C:\nvm4w\nodejs`, `%APPDATA%\npm`), LocalAppData, and Cargo bin directory.

### 4.4 Project Context & Git Integration (`src-tauri/src/project/`, `src-tauri/src/git/`)
- **Scanner:** Purely inspects file existence and JSON/TOML metadata:
  - Frameworks: React, Vue, Angular, Next.js, NestJS, Vite, Laravel, Symfony.
  - Languages & Tools: Node, TypeScript, Python, Rust, Go, PHP, Docker.
  - Explicitly ignores `.env`, private keys, and `node_modules` subtrees.
- **Git Service:**
  - Executes installed `git` CLI inside project folder.
  - Queries branch, clean/dirty state, modified/added/deleted files, unified diffs, and commit history.
  - Exposes `WorkspaceManager` abstraction with Git worktree interfaces for future multi-agent branch isolation.

### 4.5 SQLite Database & Storage (`src-tauri/src/database/`)
- Uses `rusqlite` with bundled SQLite 3.
- Tables:
  - `projects` (id, name, path, stack_json, created_at, updated_at)
  - `agents` (id, name, enabled, custom_path, settings_json)
  - `tasks` (id, project_id, title, description, status, agent_id, created_at, started_at, completed_at)
  - `executions` (id, task_id, project_id, agent_id, command, status, exit_code, duration_ms, files_changed_json, git_diff, started_at, completed_at)
  - `execution_events` (id, execution_id, event_type, payload, created_at)
  - `settings` (key, value_json, updated_at)

### 4.6 Frontend UI & UX (`apps/desktop/src/`)
- Developer tool dark theme inspired by Linear and VS Code.
- Main pages: Projects, Dashboard, Agents, Tasks, Executions, Changes (Diff), Terminal, Settings.
- Expandable bottom ConPTY terminal drawer accessible anywhere via `Ctrl + \``.
- Keyboard shortcuts: `Ctrl + O` (open project), `Ctrl + Shift + P` (command palette), `Ctrl + Shift + T` (new task), `Ctrl + Enter` (run task), `Ctrl + R` (refresh).

---

## 5. Verification & Acceptance Criteria
1. Application compiles cleanly on Windows with `cargo check` / `cargo build` and TypeScript builds cleanly with `pnpm build`.
2. Selecting a project folder analyzes and displays detected technologies (e.g. React, Node, Rust).
3. Agents screen correctly detects installed CLI agents on the Windows machine (Claude, Codex, OpenCode).
4. Running a task launches the agent CLI in the project directory inside ConPTY, streams live terminal output to xterm.js, and tracks modified files.
5. Changes screen renders unified Git diffs.
6. Execution records, exit codes, and timestamps are persisted to SQLite and reviewable in History.
7. Manual command execution (e.g. `npm test`) streams in the terminal.
8. Packaging configuration generates a Windows desktop bundle.
