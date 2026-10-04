# Security Model & Policy Engine

Because local AI coding agents possess capabilities to execute terminal commands and modify files, AI Code Orchestrator enforces strict, multi-layered security protections.

---

## 1. Path Guard & Traversal Defense

Located in `src-tauri/src/filesystem/path_guard.rs`:

- **Path Canonicalization**: All file paths supplied from IPC or agent operations are normalized via `std::fs::canonicalize`, expanding symbolic links, junctions, relative `.` / `..` segments, and Windows drive letter casing.
- **Root Enclosure Check**: Validates that every target path begins strictly with the canonicalized project root path (`target.starts_with(&root)`). Attempting to edit files outside the selected project (such as `C:\Windows`, `C:\Users\<user>\.ssh`, or other drives) results in immediate rejection with `SecurityError::PathTraversal`.
- **Sensitive Files Exemption**: The static scanner explicitly excludes sensitive file masks during project analysis:
  - `.env`, `.env.*`, `.env.local`
  - `id_rsa`, `id_ed25519`, `*.pem`, `*.key`
  - `credentials.json`, `auth.json`
  - `.git/config`, `.git/credentials`

---

## 2. Command Security Policy Engine

Located in `src-tauri/src/security/policy.rs`:

Every executed command is evaluated against strict security policy rules before dispatching:

| Risk Level | Policy Decision | Example Commands / Patterns |
|---|---|---|
| **Safe / Low** | `Allowed` | `npm test`, `cargo check`, `git status`, `git diff`, `pnpm build`, `python -m pytest` |
| **Medium** | `Requires Approval` | `npm install <pkg>`, `curl <url>`, `Invoke-WebRequest`, Network downloads |
| **High** | `Requires Approval` | `drop database`, `Remove-Item -Recurse -Force`, `del /f /s /q`, SQL migrations |
| **Blocked** | `Blocked` | `format c:`, `diskpart`, `rmdir /s /q c:\`, `shutdown`, `reg delete`, Fork bombs |

When a command requires approval, the UI automatically intercepts the execution and prompts the user via `SecurityApprovalModal` before spawning any process.
