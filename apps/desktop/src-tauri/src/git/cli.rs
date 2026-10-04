use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};

use crate::project::context::GitContext;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitInfo {
    pub hash: String,
    pub author: String,
    pub email: String,
    pub date: String,
    pub message: String,
}

pub struct GitService;

impl GitService {
    fn run_git_cmd(repo_dir: &Path, args: &[&str]) -> Result<String, String> {
        let mut cmd = Command::new("git");
        cmd.current_dir(repo_dir);
        cmd.args(args);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to execute git {:?}: {}", args, e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(err);
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    pub fn get_context(repo_dir: &Path) -> Result<GitContext, String> {
        if !repo_dir.join(".git").exists() {
            return Err("Not a git repository".to_string());
        }

        // Run git status --porcelain=v1 -b
        let status_out = Self::run_git_cmd(repo_dir, &["status", "--porcelain=v1", "-b"])?;

        let mut branch = "main".to_string();
        let mut ahead = 0;
        let mut behind = 0;
        let mut modified_files = Vec::new();
        let mut added_files = Vec::new();
        let mut deleted_files = Vec::new();
        let mut untracked_files = Vec::new();

        for line in status_out.lines() {
            if line.starts_with("##") {
                // e.g. ## main...origin/main [ahead 1, behind 2]
                let branch_part = line.trim_start_matches("##").trim();
                if let Some((b, rest)) = branch_part.split_once("...") {
                    branch = b.trim().to_string();
                    if rest.contains("[ahead ") {
                        if let Some(ahead_str) = rest.split("[ahead ").nth(1).and_then(|s| s.split(',').next()).and_then(|s| s.split(']').next()) {
                            ahead = ahead_str.trim().parse().unwrap_or(0);
                        }
                    }
                    if rest.contains("behind ") {
                        if let Some(behind_str) = rest.split("behind ").nth(1).and_then(|s| s.split(']').next()) {
                            behind = behind_str.trim().parse().unwrap_or(0);
                        }
                    }
                } else {
                    branch = branch_part.split_whitespace().next().unwrap_or("main").to_string();
                }
                continue;
            }

            if line.len() < 3 {
                continue;
            }

            let code = &line[..2];
            let file = line[3..].trim().to_string();

            if code == "??" {
                untracked_files.push(file);
            } else if code.contains('D') {
                deleted_files.push(file);
            } else if code.contains('A') {
                added_files.push(file);
            } else if code.contains('M') {
                modified_files.push(file);
            } else {
                modified_files.push(file);
            }
        }

        let is_clean = modified_files.is_empty()
            && added_files.is_empty()
            && deleted_files.is_empty()
            && untracked_files.is_empty();

        Ok(GitContext {
            branch,
            is_clean,
            ahead,
            behind,
            modified_files,
            added_files,
            deleted_files,
            untracked_files,
        })
    }

    pub fn get_diff(repo_dir: &Path, file: Option<&str>) -> Result<String, String> {
        let mut args = vec!["diff", "HEAD"];
        if let Some(f) = file {
            args.push("--");
            args.push(f);
        }

        // If repo has no commits yet (HEAD doesn't exist), fall back to git diff
        match Self::run_git_cmd(repo_dir, &args) {
            Ok(diff) => Ok(diff),
            Err(_) => {
                let mut fallback_args = vec!["diff"];
                if let Some(f) = file {
                    fallback_args.push("--");
                    fallback_args.push(f);
                }
                Self::run_git_cmd(repo_dir, &fallback_args)
            }
        }
    }

    pub fn get_log(repo_dir: &Path, count: usize) -> Result<Vec<GitCommitInfo>, String> {
        let count_str = format!("-n{}", count);
        let out = Self::run_git_cmd(
            repo_dir,
            &["log", &count_str, "--pretty=format:%H|%an|%ae|%ad|%s", "--date=iso"],
        )?;

        let mut commits = Vec::new();
        for line in out.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 5 {
                commits.push(GitCommitInfo {
                    hash: parts[0].to_string(),
                    author: parts[1].to_string(),
                    email: parts[2].to_string(),
                    date: parts[3].to_string(),
                    message: parts[4..].join("|"),
                });
            }
        }

        Ok(commits)
    }

    pub fn stage_and_commit(
        repo_dir: &Path,
        files: Option<&[&str]>,
        message: &str,
    ) -> Result<String, String> {
        if let Some(file_list) = files {
            for f in file_list {
                Self::run_git_cmd(repo_dir, &["add", f])?;
            }
        } else {
            Self::run_git_cmd(repo_dir, &["add", "-A"])?;
        }

        Self::run_git_cmd(repo_dir, &["commit", "-m", message])
    }
}
