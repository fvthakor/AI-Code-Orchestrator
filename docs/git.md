# Git Operations & Worktree Workflow

AI Code Orchestrator integrates directly with the installed Git for Windows CLI to provide real-time diff tracking, status inspection, and safe task branch isolation.

---

## Git Service Architecture

Located in `src-tauri/src/git/cli.rs` and `src-tauri/src/git/worktree.rs`:

- **Installed Git CLI Integration**: Runs standard `git.exe` commands within the project directory without requiring embedded `libgit2` C dependencies.
- **Status & Inspection**:
  - `git status --porcelain=v1 -b`: Parses branch name, ahead/behind counters, modified, added, deleted, and untracked files.
  - `git diff`: Generates unified diffs against the working tree or index.
  - `git log`: Retrieves recent commit history with commit hash, author, date, and commit message.
  - `git commit`: Stages selected files or all changes and creates a signed/unsigned commit with a user-provided message.

---

## Git Worktree Isolation

To prevent concurrent AI agent executions from clobbering an active developer's working directory:

- `GitWorktreeManager` allows spawning a dedicated worktree for a task:
  ```powershell
  git worktree add -b ai/task-<id> .orchestrator/worktrees/task-<id>
  ```
- The AI agent runs its modifications and tests entirely inside the isolated worktree directory.
- When the task is complete, the developer can inspect the unified diff and either merge the worktree branch or remove it via `git worktree remove`.
