# AI Agent Adapter Framework

The Agent Adapter Framework enables AI Code Orchestrator to interact with different local AI coding CLIs through a single, consistent interface.

## The `AgentAdapter` Trait

Defined in `apps/desktop/src-tauri/src/agents/adapter.rs`:

```rust
pub trait AgentAdapter: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn default_executable(&self) -> &str;
    fn capabilities(&self) -> AgentCapability;

    fn detect(&self, custom_path: Option<&str>) -> Result<AgentInfo>;
    fn build_execution_command(&self, prompt: &str, project_path: &Path) -> Result<Vec<String>>;
    fn format_prompt(&self, prompt: &str, project_path: &Path) -> String;
}
```

---

## Supported Agent Adapters in V1

### 1. Claude Code (`ClaudeAdapter`)
- **Default Executable**: `claude` (resolves to `claude.cmd` or `claude.exe` via Windows PATH or npm prefix).
- **Detection**: Checks Windows `PATHEXT` (`.CMD`, `.BAT`, `.EXE`), `%APPDATA%\npm`, `%LOCALAPPDATA%\Programs`, and nvm directories.
- **Version Query**: Executes `claude --version`.
- **Command Construction**: Runs `claude -p "<prompt>"` in headless/print mode or interactive ConPTY session.
- **Capabilities**:
  - File Editing: Supported
  - ConPTY Terminal: Supported
  - Git Operations: Supported

### 2. OpenAI Codex CLI (`CodexAdapter`)
- **Default Executable**: `codex` (resolves to `codex.cmd` or `codex.exe`).
- **Detection**: Probes Windows paths and executes `codex --version`.
- **Command Construction**: Runs `codex exec "<prompt>"`.
- **Capabilities**: Full code editing, terminal execution, and Git tracking.

### 3. OpenCode (`OpenCodeAdapter`)
- **Default Executable**: `opencode` (resolves to `opencode.cmd` or `opencode.exe`).
- **Detection**: Probes Windows paths and executes `opencode --version`.
- **Command Construction**: Runs `opencode run "<prompt>"`.
- **Capabilities**: Code generation, execution, and local diff inspection.

---

## Adding New Agents

To add a new agent adapter (e.g. `GeminiAdapter` or `CustomCliAdapter`):

1. Create `src-tauri/src/agents/my_agent.rs` implementing `AgentAdapter`.
2. Register the adapter in `AgentRegistry::new()` located in `src-tauri/src/agents/registry.rs`.
3. The frontend UI will automatically detect, display, and enable task orchestration for the new agent without any frontend code changes.
