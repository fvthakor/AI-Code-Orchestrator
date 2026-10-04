# AI Code Orchestrator — Windows V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, production-quality Windows desktop application using Tauri v2, Rust, React, TypeScript, Tailwind CSS, SQLite, and ConPTY that acts as a local orchestration layer for AI coding CLIs (Claude Code, Codex CLI, OpenCode), featuring project scanning, interactive streaming terminal, Git diff inspection, command execution, and security guards.

**Architecture:** Monorepo with `apps/desktop` (React UI + Rust Tauri core) and `packages/shared-types`. The backend employs native Windows ConPTY (`portable-pty`) for authentic interactive terminal streaming, `rusqlite` for embedded database management, and a modular `AgentAdapter` registry for AI CLIs. Rust serves as the authoritative engine for processes, security, and filesystem safety, streaming events to React via typed Tauri IPC.

**Tech Stack:** Tauri v2, Rust 1.93+, React 18/19, TypeScript strict mode, Vite, Tailwind CSS, Zustand, @xterm/xterm, portable-pty, rusqlite (bundled), notify.

**Spec:** `docs/superpowers/specs/2026-10-04-ai-code-orchestrator-design.md`

## Global Constraints
- Target OS: Windows 10/11 x64.
- Shell: PowerShell (`powershell.exe -NoProfile -ExecutionPolicy Bypass`) default.
- Process safety: Attach child processes to Win32 Job Objects or process tree termination to prevent zombie processes.
- Security: Sensitive paths (`.env*`, `.ssh`, system directories) blocked. Command execution policies enforced with approval prompts.
- Database: Embedded SQLite with migrations. No secrets stored in plain text.
- Agents: Abstracted via `AgentAdapter` trait (Claude, Codex, OpenCode).

---

### Task 1: Monorepo & Project Scaffolding (Phase 1)

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/src/index.ts`
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: Node.js 22+, pnpm, Rust 1.93+, Cargo.
- Produces: Working Tauri v2 + Vite + React 18/19 compilation baseline.

- [ ] **Step 1: Create root monorepo configuration files**
Create `package.json` and `pnpm-workspace.yaml` linking `apps/*` and `packages/*`.

- [ ] **Step 2: Create `packages/shared-types`**
Define TypeScript interfaces for `Project`, `ProjectContext`, `AgentInfo`, `AgentCapability`, `Task`, `Execution`, `ExecutionEvent`, `CommandPolicy`, and IPC message payloads.

- [ ] **Step 3: Scaffold `apps/desktop` frontend**
Configure Vite, React, TypeScript strict mode, Tailwind CSS (`tailwind.config.js`, `postcss.config.js`), and install dependencies (`@tauri-apps/api`, `zustand`, `lucide-react`, `@xterm/xterm`, `@xterm/addon-fit`, `clsx`, `tailwind-merge`).

- [ ] **Step 4: Scaffold `apps/desktop/src-tauri`**
Configure `Cargo.toml` with `tauri = "2"`, `serde`, `serde_json`, `tokio`, `rusqlite = { version = "0.33", features = ["bundled"] }`, `portable-pty = "0.8"`, `uuid = { version = "1", features = ["v4", "serde"] }`, `chrono = { version = "0.4", features = ["serde"] }`, `which = "7"`, `notify = "8"`.
Create `tauri.conf.json` and `capabilities/default.json`.

- [ ] **Step 5: Verify build compilation**
Run `pnpm install` and verify `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.

- [ ] **Step 6: Commit**
```bash
git add .
git commit -m "feat: scaffold monorepo with tauri v2, react, and rust baseline"
```

---

### Task 2: SQLite Database & Migrations (Phase 2 - Part 1)

**Files:**
- Create: `apps/desktop/src-tauri/src/database/mod.rs`
- Create: `apps/desktop/src-tauri/src/database/schema.rs`
- Create: `apps/desktop/src-tauri/src/database/migrations.rs`
- Create: `apps/desktop/src-tauri/src/models/mod.rs`
- Create: `apps/desktop/src-tauri/src/models/db.rs`
- Test: `apps/desktop/src-tauri/tests/database_test.rs`

**Interfaces:**
- Consumes: `rusqlite` bundled connection pool / mutex.
- Produces: `DbManager` struct with CRUD operations for projects, agents, tasks, executions, execution_events, and settings.

- [ ] **Step 1: Write the failing database integration test**
Write `tests/database_test.rs` testing in-memory SQLite initialization, running migrations, inserting and retrieving a project, a task, and an execution record.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_test`
Expected: FAIL (modules do not exist yet).

- [ ] **Step 3: Implement database models, schema, and migration runner**
Implement tables:
- `projects` (id, name, path, stack_json, created_at, updated_at)
- `agents` (id, name, enabled, custom_path, settings_json)
- `tasks` (id, project_id, title, description, status, agent_id, created_at, started_at, completed_at)
- `executions` (id, task_id, project_id, agent_id, command, status, exit_code, duration_ms, files_changed_json, git_diff, started_at, completed_at)
- `execution_events` (id, execution_id, event_type, payload, created_at)
- `settings` (key, value_json, updated_at)

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src-tauri/
git commit -m "feat(db): implement sqlite database migrations and repository layer"
```

---

### Task 3: Project Scanner, Context Analyzer & Path Security (Phase 2 - Part 2)

**Files:**
- Create: `apps/desktop/src-tauri/src/filesystem/mod.rs`
- Create: `apps/desktop/src-tauri/src/filesystem/path_guard.rs`
- Create: `apps/desktop/src-tauri/src/filesystem/scanner.rs`
- Create: `apps/desktop/src-tauri/src/project/mod.rs`
- Create: `apps/desktop/src-tauri/src/project/context.rs`
- Test: `apps/desktop/src-tauri/tests/scanner_test.rs`

**Interfaces:**
- Consumes: Target directory path `PathBuf`.
- Produces: `PathGuard::validate_project_path(&path)`, `ProjectScanner::scan(&path) -> ProjectContext`.

- [ ] **Step 1: Write failing tests for scanner and path guard**
Write `tests/scanner_test.rs`:
- Test rejection of sensitive paths (`C:\Windows`, `.ssh`, `.env`).
- Test detection of Node (React, Next.js, Vite), Rust (Cargo), PHP (Laravel, Composer), Python, Docker from fixture mock metadata files.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test scanner_test`
Expected: FAIL.

- [ ] **Step 3: Implement PathGuard and ProjectScanner**
Implement path sanitization, root validation, and metadata inspection without running arbitrary scripts.

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test scanner_test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src-tauri/
git commit -m "feat(scanner): implement project scanner, context analyzer, and path guard"
```

---

### Task 4: Process Manager with Windows ConPTY & PowerShell (Phase 3)

**Files:**
- Create: `apps/desktop/src-tauri/src/execution/mod.rs`
- Create: `apps/desktop/src-tauri/src/execution/pty_session.rs`
- Create: `apps/desktop/src-tauri/src/execution/process_manager.rs`
- Create: `apps/desktop/src-tauri/src/execution/job_object.rs`
- Test: `apps/desktop/src-tauri/tests/process_test.rs`

**Interfaces:**
- Consumes: `portable-pty`, Windows ConPTY.
- Produces: `ProcessManager::spawn_session(...) -> SessionId`, `write_input(session_id, data)`, `resize(session_id, cols, rows)`, `kill(session_id)`.

- [ ] **Step 1: Write failing test for ConPTY process execution**
Write `tests/process_test.rs`:
- Test spawning a PowerShell session in a directory.
- Test reading output bytes.
- Test killing session cleanly and asserting exit status.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test process_test`
Expected: FAIL.

- [ ] **Step 3: Implement ProcessManager and Win32 Job Object cleanup**
Implement ConPTY session handling using `portable-pty::native_pty_system()`, background stream reader thread that sends events, writer channel for stdin, and process tree termination via Job Object / taskkill fallback.

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test process_test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src-tauri/
git commit -m "feat(execution): implement windows conpty process manager and cleanup"
```

---

### Task 5: Agent Architecture, Adapters & Windows Detection (Phase 4)

**Files:**
- Create: `apps/desktop/src-tauri/src/agents/mod.rs`
- Create: `apps/desktop/src-tauri/src/agents/adapter.rs`
- Create: `apps/desktop/src-tauri/src/agents/resolver.rs`
- Create: `apps/desktop/src-tauri/src/agents/claude.rs`
- Create: `apps/desktop/src-tauri/src/agents/codex.rs`
- Create: `apps/desktop/src-tauri/src/agents/opencode.rs`
- Create: `apps/desktop/src-tauri/src/agents/registry.rs`
- Test: `apps/desktop/src-tauri/tests/agent_test.rs`

**Interfaces:**
- Consumes: `AgentAdapter` trait.
- Produces: `AgentRegistry` with Claude, Codex, and OpenCode adapters, Windows executable resolution (`.cmd`, `.exe`, `.bat`), safe version query, and capabilities.

- [ ] **Step 1: Write failing test for agent detection and adapter interface**
Write `tests/agent_test.rs` testing detection on the host system (verifying Claude, Codex, OpenCode discovery and version queries).

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test agent_test`
Expected: FAIL.

- [ ] **Step 3: Implement Windows executable resolver and Agent adapters**
Implement `WindowsExecutableResolver` searching PATH, PATHEXT, npm global directories (`C:\nvm4w\nodejs`, `%APPDATA%\npm`), LocalAppData, and Cargo bin.
Implement `ClaudeAdapter`, `CodexAdapter`, and `OpenCodeAdapter`.

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test agent_test`
Expected: PASS (all detected agents return clean versions).

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src-tauri/
git commit -m "feat(agents): implement agent adapter abstraction and windows detection"
```

---

### Task 6: Git Service & Worktree Foundation (Phase 5)

**Files:**
- Create: `apps/desktop/src-tauri/src/git/mod.rs`
- Create: `apps/desktop/src-tauri/src/git/cli.rs`
- Create: `apps/desktop/src-tauri/src/git/worktree.rs`
- Test: `apps/desktop/src-tauri/tests/git_test.rs`

**Interfaces:**
- Consumes: Target repository directory.
- Produces: `GitService` with `status()`, `diff()`, `branch()`, `log()`, `add()`, `commit()`, and `WorkspaceManager` worktree foundation.

- [ ] **Step 1: Write failing test for Git operations**
Write `tests/git_test.rs` on a temporary git repository testing branch query, status, diff detection on modified files, and log inspection.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test git_test`
Expected: FAIL.

- [ ] **Step 3: Implement GitService and WorkspaceManager**
Implement Git CLI executions using `powershell` / `git.exe`, parsing status porcelain, unified diff, and commits.

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test git_test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src-tauri/
git commit -m "feat(git): implement git service, diff analyzer, and worktree abstraction"
```

---

### Task 7: Security Policy Engine & Approval Gate (Phase 6)

**Files:**
- Create: `apps/desktop/src-tauri/src/security/mod.rs`
- Create: `apps/desktop/src-tauri/src/security/policy.rs`
- Create: `apps/desktop/src-tauri/src/security/sanitizer.rs`
- Test: `apps/desktop/src-tauri/tests/security_test.rs`

**Interfaces:**
- Consumes: Command string and directory path.
- Produces: `PolicyEngine::evaluate(&cmd, &cwd) -> EvaluationResult (Allowed | RequiresApproval | Blocked)`.

- [ ] **Step 1: Write failing test for Security Policy evaluation**
Write `tests/security_test.rs` verifying whitelist for `npm test`, `git status`, `cargo build`, blocking for `format`, `diskpart`, `rmdir /s /q C:\`, and flagging high-risk commands for user approval.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test security_test`
Expected: FAIL.

- [ ] **Step 3: Implement PolicyEngine and Sanitizer**
Implement command tokenizer, argument analyzer, destructive pattern matcher, and sensitive directory checker.

- [ ] **Step 4: Run test to verify it passes**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test security_test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src-tauri/
git commit -m "feat(security): implement command execution policy engine and safety filter"
```

---

### Task 8: Tauri IPC Commands & Application State Integration (Phase 7 - Part 1)

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/mod.rs`
- Create: `apps/desktop/src-tauri/src/commands/projects.rs`
- Create: `apps/desktop/src-tauri/src/commands/agents.rs`
- Create: `apps/desktop/src-tauri/src/commands/tasks.rs`
- Create: `apps/desktop/src-tauri/src/commands/executions.rs`
- Create: `apps/desktop/src-tauri/src/commands/terminal.rs`
- Create: `apps/desktop/src-tauri/src/commands/git.rs`
- Create: `apps/desktop/src-tauri/src/commands/security.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: All backend subsystems (DbManager, ProcessManager, AgentRegistry, GitService, PolicyEngine).
- Produces: Registered Tauri IPC commands and event streaming.

- [ ] **Step 1: Implement typed Tauri commands**
Expose `project_select_folder`, `project_analyze`, `agent_list`, `agent_detect`, `agent_test`, `task_create`, `task_list`, `task_run`, `task_cancel`, `execution_list`, `execution_get`, `terminal_spawn`, `terminal_write`, `terminal_resize`, `terminal_kill`, `git_status`, `git_diff`, `git_log`, `security_evaluate`.

- [ ] **Step 2: Connect Tauri AppState and Event Emitters**
Set up state containers in `lib.rs` and configure event listeners for PTY stdout broadcasting.

- [ ] **Step 3: Verify compilation with cargo check**
Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: SUCCESS with 0 errors.

- [ ] **Step 4: Commit**
```bash
git add apps/desktop/src-tauri/
git commit -m "feat(ipc): expose typed tauri commands and wire event pipeline"
```

---

### Task 9: Frontend Architecture, Stores & UI Services (Phase 7 - Part 2)

**Files:**
- Create: `apps/desktop/src/services/ipc.ts`
- Create: `apps/desktop/src/stores/useProjectStore.ts`
- Create: `apps/desktop/src/stores/useAgentStore.ts`
- Create: `apps/desktop/src/stores/useTaskStore.ts`
- Create: `apps/desktop/src/stores/useExecutionStore.ts`
- Create: `apps/desktop/src/stores/useTerminalStore.ts`
- Create: `apps/desktop/src/stores/useSettingsStore.ts`
- Create: `apps/desktop/src/hooks/useKeyboardShortcuts.ts`
- Create: `apps/desktop/src/components/ui/` (Button, Dialog, Badge, Input, Card, Tabs, Toast)

**Interfaces:**
- Consumes: `@tauri-apps/api`.
- Produces: Reactive Zustand stores and type-safe IPC client wrappers.

- [ ] **Step 1: Implement typed IPC service layer**
Wrap all Tauri invokes with strict TypeScript models and error handling.

- [ ] **Step 2: Implement Zustand stores**
Create stores for projects, agents, tasks, executions, and terminal sessions with live event subscriptions.

- [ ] **Step 3: Implement core UI primitives**
Create clean, developer-focused accessible components with Tailwind CSS.

- [ ] **Step 4: Implement keyboard shortcut hooks**
Wire `Ctrl + O`, `Ctrl + Shift + P`, `Ctrl + Enter`, `Ctrl + \``, `Ctrl + Shift + T`, `Ctrl + R`.

- [ ] **Step 5: Verify frontend linting and typecheck**
Run: `pnpm --filter desktop typecheck`
Expected: SUCCESS.

- [ ] **Step 6: Commit**
```bash
git add apps/desktop/src/
git commit -m "feat(frontend): implement zustand stores, ipc services, and ui primitives"
```

---

### Task 10: Complete UI Pages & Interactive Features (Phase 7 - Part 3)

**Files:**
- Create: `apps/desktop/src/components/TerminalView.tsx`
- Create: `apps/desktop/src/components/GitDiffView.tsx`
- Create: `apps/desktop/src/components/CommandPalette.tsx`
- Create: `apps/desktop/src/components/SecurityApprovalModal.tsx`
- Create: `apps/desktop/src/components/NewTaskModal.tsx`
- Create: `apps/desktop/src/layouts/AppLayout.tsx`
- Create: `apps/desktop/src/pages/DashboardPage.tsx`
- Create: `apps/desktop/src/pages/ProjectsPage.tsx`
- Create: `apps/desktop/src/pages/AgentsPage.tsx`
- Create: `apps/desktop/src/pages/TasksPage.tsx`
- Create: `apps/desktop/src/pages/ExecutionsPage.tsx`
- Create: `apps/desktop/src/pages/ChangesPage.tsx`
- Create: `apps/desktop/src/pages/SettingsPage.tsx`
- Modify: `apps/desktop/src/App.tsx`

**Interfaces:**
- Consumes: Stores, components, xterm.js.
- Produces: Full interactive UI meeting all 35 user requirements.

- [ ] **Step 1: Implement TerminalView component with `@xterm/xterm`**
Initialize xterm instance, attach `FitAddon`, bind PTY event streaming (`terminal-output`) and user typing (`terminal_write`).

- [ ] **Step 2: Implement GitDiffView and Changes page**
Render file trees, modified file status badges, and syntax-highlighted unified diffs.

- [ ] **Step 3: Implement Dashboard, Projects, Tasks, and Executions pages**
Display project stats, technology stacks, agent status cards, task boards, and execution detail views.

- [ ] **Step 4: Implement Agents, Settings, Command Palette, and Security Modal**
Provide agent path testing, security approval dialog, and settings configuration.

- [ ] **Step 5: Verify frontend build**
Run: `pnpm --filter desktop build`
Expected: SUCCESS.

- [ ] **Step 6: Commit**
```bash
git add apps/desktop/src/
git commit -m "feat(ui): complete all desktop pages, terminal view, and git diff viewer"
```

---

### Task 11: End-to-End Integration, Tests & Windows Installer Build (Phase 8)

**Files:**
- Create: `tests/integration/`
- Create: `docs/architecture.md`
- Create: `docs/agents.md`
- Create: `docs/execution.md`
- Create: `docs/security.md`
- Create: `docs/git.md`
- Create: `docs/development.md`
- Create: `README.md`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: Complete application stack.
- Produces: Passing end-to-end integration tests, complete documentation, and Windows installer bundle configuration (`msi` / `nsis`).

- [ ] **Step 1: Run complete Rust test suite**
Run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: All tests pass.

- [ ] **Step 2: Run frontend test and build**
Run: `pnpm build`
Expected: All packages and desktop app build cleanly.

- [ ] **Step 3: Build Windows desktop application binary**
Run: `pnpm tauri build` (or cargo tauri build / verify binary creation).

- [ ] **Step 4: Write comprehensive documentation**
Write `README.md` and `docs/*.md` covering architecture, adding custom agents (e.g. Gemini, Ollama), security model, and developer setup.

- [ ] **Step 5: Commit**
```bash
git add .
git commit -m "feat: complete end-to-end integration, documentation, and windows packaging"
```
