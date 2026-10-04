use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub path: PathBuf,
    pub branch: String,
    pub is_bare: bool,
}

pub struct WorkspaceManager;

impl WorkspaceManager {
    pub fn list_worktrees(repo_dir: &Path) -> Result<Vec<WorktreeInfo>, String> {
        let mut cmd = Command::new("git");
        cmd.current_dir(repo_dir);
        cmd.args(["worktree", "list", "--porcelain"]);
        cmd.creation_flags(0x08000000);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to list worktrees: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(err);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut worktrees = Vec::new();
        let mut current_path = PathBuf::new();
        let mut current_branch = String::new();
        let mut is_bare = false;

        for line in stdout.lines() {
            if line.starts_with("worktree ") {
                if !current_path.as_os_str().is_empty() {
                    worktrees.push(WorktreeInfo {
                        path: current_path,
                        branch: current_branch,
                        is_bare,
                    });
                    current_branch = String::new();
                    is_bare = false;
                }
                current_path = PathBuf::from(line["worktree ".len()..].trim());
            } else if line.starts_with("branch ") {
                current_branch = line["branch ".len()..]
                    .trim()
                    .trim_start_matches("refs/heads/")
                    .to_string();
            } else if line.trim() == "bare" {
                is_bare = true;
            }
        }

        if !current_path.as_os_str().is_empty() {
            worktrees.push(WorktreeInfo {
                path: current_path,
                branch: current_branch,
                is_bare,
            });
        }

        Ok(worktrees)
    }

    pub fn create_worktree(repo_dir: &Path, branch: &str, target_path: &Path) -> Result<(), String> {
        let mut cmd = Command::new("git");
        cmd.current_dir(repo_dir);
        cmd.args([
            "worktree",
            "add",
            target_path.to_str().unwrap_or(""),
            "-b",
            branch,
        ]);
        cmd.creation_flags(0x08000000);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to create worktree: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(err);
        }

        Ok(())
    }

    pub fn remove_worktree(repo_dir: &Path, target_path: &Path) -> Result<(), String> {
        let mut cmd = Command::new("git");
        cmd.current_dir(repo_dir);
        cmd.args([
            "worktree",
            "remove",
            "--force",
            target_path.to_str().unwrap_or(""),
        ]);
        cmd.creation_flags(0x08000000);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to remove worktree: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(err);
        }

        Ok(())
    }
}
