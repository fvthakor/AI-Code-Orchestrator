# Windows ConPTY Execution & Process Management

AI Code Orchestrator incorporates an authentic Windows pseudo-terminal engine combined with kernel-level Win32 Job Object process containment.

## Architecture & Lifecycle

```
Frontend (@xterm/xterm)
      │
      │ IPC: terminal_write / terminal_resize / terminal_spawn
      ▼
Tauri IPC Bridge
      │
      ▼
PtySession (portable-pty)
      ├── ConPTY Master / Slave
      ├── Background Read Thread (Chunk reader -> Tauri Event emit)
      │
      ▼
Windows Child Process (powershell.exe / claude.cmd)
      ▲
      │ Assigned on spawn
Win32 Job Object
      └── Limit: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
```

---

## Key Components

### 1. ConPTY Integration (`portable_pty`)
- On Windows 10/11, `portable_pty::native_pty_system()` interfaces with Microsoft's official Windows Pseudo Console (ConPTY) subsystem (`conhost.exe`).
- Provides 100% genuine VT100 / ANSI escape sequence parsing, terminal colors, cursor positioning, and line wrapping.
- Matches dimensions dynamically via `resizeTerminal(cols, rows)` and xterm's `FitAddon`.

### 2. Win32 Job Object Containment (`WinJobObject`)
- Located in `src-tauri/src/execution/job_object.rs`.
- Creates a dedicated Win32 Job Object via `CreateJobObjectW`.
- Configures `JOBOBJECT_EXTENDED_LIMIT_INFORMATION` with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
- When a task process is spawned, its process handle is assigned to the Job Object via `AssignProcessToJobObject`.
- **Guarantee**: If the task completes, gets cancelled, crashes, or the orchestrator exits, Windows automatically terminates every process in the hierarchy, eliminating runaway background processes.

### 3. Fallback Process Tree Termination (`taskkill`)
- In addition to Job Objects, when `terminate()` is invoked, `taskkill.exe /F /T /PID <pid>` is executed as a defense-in-depth safety measure to ensure instant teardown.
