use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;
use crate::models::db::GitHubPrResult;

pub struct GitHubService;

impl GitHubService {
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

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// Initializes a repository if not present, and sets up the remote origin URL.
    pub fn init_or_link_repo(
        repo_dir: &Path,
        remote_url: Option<&str>,
        default_branch: Option<&str>,
    ) -> Result<String, String> {
        let branch = default_branch.unwrap_or("master");

        if !repo_dir.join(".git").exists() {
            Self::run_git_cmd(repo_dir, &["init", "-b", branch])?;
        }

        if let Some(url) = remote_url {
            let clean_url = url.trim();
            if !clean_url.is_empty() {
                // Check if origin already exists
                match Self::run_git_cmd(repo_dir, &["remote", "get-url", "origin"]) {
                    Ok(_) => {
                        Self::run_git_cmd(repo_dir, &["remote", "set-url", "origin", clean_url])?;
                    }
                    Err(_) => {
                        Self::run_git_cmd(repo_dir, &["remote", "add", "origin", clean_url])?;
                    }
                }
            }
        }

        Self::get_remote_url(repo_dir)
    }

    /// Returns the remote origin URL if configured.
    pub fn get_remote_url(repo_dir: &Path) -> Result<String, String> {
        Self::run_git_cmd(repo_dir, &["remote", "get-url", "origin"])
    }

    /// Creates a new branch and checks it out.
    pub fn checkout_branch(repo_dir: &Path, branch_name: &str) -> Result<(), String> {
        // Try creating new branch
        if let Err(_) = Self::run_git_cmd(repo_dir, &["checkout", "-b", branch_name]) {
            // Fall back to checking out existing branch
            Self::run_git_cmd(repo_dir, &["checkout", branch_name])?;
        }
        Ok(())
    }

    /// Pushes branch to origin.
    pub fn push_branch(repo_dir: &Path, branch_name: &str) -> Result<String, String> {
        Self::run_git_cmd(repo_dir, &["push", "-u", "origin", branch_name])
    }

    /// Prepares task branch: pulls base branch from remote if available, then checkouts task branch.
    pub fn prepare_task_branch(
        repo_dir: &Path,
        task_slug: &str,
        base_branch: Option<&str>,
    ) -> Result<String, String> {
        if !repo_dir.join(".git").exists() {
            return Ok("".to_string());
        }

        // Determine base branch: default to "master" or "main"
        let base = if let Some(b) = base_branch {
            b.to_string()
        } else {
            // Check if main exists, else master
            if Self::run_git_cmd(repo_dir, &["rev-parse", "--verify", "main"]).is_ok() {
                "main".to_string()
            } else if Self::run_git_cmd(repo_dir, &["rev-parse", "--verify", "master"]).is_ok() {
                "master".to_string()
            } else {
                "master".to_string()
            }
        };

        // Try checkout base
        let _ = Self::run_git_cmd(repo_dir, &["checkout", &base]);

        // Try pull from origin (swallow error if offline or no remote)
        let _ = Self::run_git_cmd(repo_dir, &["pull", "origin", &base]);

        // Clean task slug
        let sanitized = task_slug
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '/' { c } else { '-' })
            .collect::<String>()
            .to_lowercase();
        let branch_name = if sanitized.starts_with("feat/") {
            sanitized
        } else {
            format!("feat/{}", sanitized.trim_matches('-'))
        };

        Self::checkout_branch(repo_dir, &branch_name)?;
        Ok(branch_name)
    }

    /// Switches to an existing task branch without pulling or resetting, so uncommitted work from an interrupted run survives.
    pub fn resume_task_branch(repo_dir: &Path, branch_name: &str) -> Result<String, String> {
        if !repo_dir.join(".git").exists() {
            return Ok(String::new());
        }
        Self::run_git_cmd(repo_dir, &["checkout", branch_name])?;
        Ok(branch_name.to_string())
    }

    /// Stages all changes, commits, and pushes branch to origin.
    pub fn commit_and_push(
        repo_dir: &Path,
        branch_name: &str,
        commit_message: &str,
    ) -> Result<String, String> {
        if !repo_dir.join(".git").exists() {
            return Ok("Not a git repository".to_string());
        }

        // git add -A
        Self::run_git_cmd(repo_dir, &["add", "-A"])?;

        // check status: an empty diff means the developer produced no work, which must fail the task
        let status = Self::run_git_cmd(repo_dir, &["status", "--porcelain"])?;
        if status.trim().is_empty() {
            return Err(format!(
                "No changes to commit on branch '{}': the developer produced no file changes",
                branch_name
            ));
        }

        // git commit -m <msg>
        Self::run_git_cmd(repo_dir, &["commit", "-m", commit_message])?;

        // Local-only repos have no origin: the commit is the deliverable
        if Self::get_remote_url(repo_dir).is_err() {
            return Ok(format!("Committed locally on '{}' (no remote configured)", branch_name));
        }

        // git push -u origin <branch>: a failed push must fail the task, not pass silently
        let msg = Self::push_branch(repo_dir, branch_name)
            .map_err(|err| format!("Push of '{}' to origin failed: {}", branch_name, err))?;
        Ok(format!("Committed and pushed to origin/{}: {}", branch_name, msg))
    }

    /// Parses owner and repository name from GitHub URLs (HTTPS or SSH).
    pub fn parse_github_repo(remote_url: &str) -> Option<(String, String)> {
        let clean = remote_url.trim().trim_end_matches(".git");

        if let Some(idx) = clean.find("github.com/") {
            let path = &clean[idx + "github.com/".len()..];
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() >= 2 {
                return Some((parts[0].to_string(), parts[1].to_string()));
            }
        } else if let Some(idx) = clean.find("github.com:") {
            let path = &clean[idx + "github.com:".len()..];
            let parts: Vec<&str> = path.split('/').collect();
            if parts.len() >= 2 {
                return Some((parts[0].to_string(), parts[1].to_string()));
            }
        }

        None
    }

    /// Simple URL encoder for query parameters without external dependencies.
    pub fn url_encode(input: &str) -> String {
        let mut encoded = String::new();
        for b in input.bytes() {
            match b {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(b as char);
                }
                b' ' => encoded.push_str("%20"),
                _ => {
                    encoded.push_str(&format!("%{:02X}", b));
                }
            }
        }
        encoded
    }

    /// Generates pre-filled GitHub Web Compare & PR URL.
    pub fn generate_compare_url(
        owner: &str,
        repo: &str,
        base: &str,
        head: &str,
        title: &str,
        body: &str,
    ) -> String {
        let enc_title = Self::url_encode(title);
        let enc_body = Self::url_encode(body);
        format!(
            "https://github.com/{}/{}/compare/{}...{}?expand=1&title={}&body={}",
            owner, repo, base, head, enc_title, enc_body
        )
    }

    /// 3-Tier Pull Request Creation:
    /// Tier 1: GitHub REST API via Windows curl.exe (if PAT token provided)
    /// Tier 2: GitHub CLI `gh pr create` (if gh is in PATH)
    /// Tier 3: Universal Web Link (100% reliable fallback)
    pub fn create_pr(
        repo_dir: &Path,
        branch: &str,
        base: Option<&str>,
        title: &str,
        body: &str,
        pat_token: Option<&str>,
        repo_url_override: Option<&str>,
    ) -> Result<GitHubPrResult, String> {
        let remote_url = if let Some(url) = repo_url_override {
            url.to_string()
        } else {
            Self::get_remote_url(repo_dir)
                .map_err(|_| "No Git remote origin configured. Please provide a GitHub URL.".to_string())?
        };

        let (owner, repo) = Self::parse_github_repo(&remote_url).ok_or_else(|| {
            format!("Failed to parse GitHub owner and repository from remote URL '{}'", remote_url)
        })?;

        let base_branch = base.unwrap_or("master");

        // --- Tier 1: Direct GitHub REST API via curl.exe (Zero extra tool dependencies) ---
        if let Some(token) = pat_token {
            let clean_token = token.trim();
            if !clean_token.is_empty() {
                let api_url = format!("https://api.github.com/repos/{}/{}/pulls", owner, repo);
                let payload = serde_json::json!({
                    "title": title,
                    "head": branch,
                    "base": base_branch,
                    "body": body
                }).to_string();

                let mut cmd = Command::new("curl.exe");
                cmd.args(&[
                    "-s",
                    "-X", "POST",
                    &api_url,
                    "-H", &format!("Authorization: Bearer {}", clean_token),
                    "-H", "Accept: application/vnd.github+json",
                    "-H", "User-Agent: AI-Code-Orchestrator",
                    "-d", &payload,
                ]);
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

                if let Ok(output) = cmd.output() {
                    let resp_str = String::from_utf8_lossy(&output.stdout);
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&resp_str) {
                        if let Some(html_url) = val.get("html_url").and_then(|u| u.as_str()) {
                            return Ok(GitHubPrResult {
                                pr_url: html_url.to_string(),
                                method: "api".to_string(),
                                is_web_fallback: false,
                            });
                        }
                    }
                }
            }
        }

        // --- Tier 2: GitHub CLI `gh pr create` (if available in PATH) ---
        if which::which("gh").is_ok() {
            let mut cmd = Command::new("gh");
            cmd.current_dir(repo_dir);
            cmd.args(&[
                "pr", "create",
                "--title", title,
                "--body", body,
                "--base", base_branch,
                "--head", branch,
            ]);
            cmd.creation_flags(0x08000000);

            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if out_str.starts_with("http") {
                        return Ok(GitHubPrResult {
                            pr_url: out_str,
                            method: "cli".to_string(),
                            is_web_fallback: false,
                        });
                    }
                }
            }
        }

        // --- Tier 3: Universal Pre-filled Web Compare & PR Link (Zero dependencies) ---
        let web_url = Self::generate_compare_url(&owner, &repo, base_branch, branch, title, body);
        Ok(GitHubPrResult {
            pr_url: web_url,
            method: "web".to_string(),
            is_web_fallback: true,
        })
    }

    /// Checks whether a task branch has been merged into base branch (master/main).
    /// Supports:
    /// - Standard merge commit & fast-forward (`git merge-base --is-ancestor`)
    /// - Squash & merge / Rebase (empty diff between base and branch)
    /// - Remote branch deletion on GitHub after PR merge
    /// - Local-only repositories
    pub fn is_branch_merged(
        repo_dir: &Path,
        branch_name: &str,
        base_branch: Option<&str>,
    ) -> Result<bool, String> {
        if !repo_dir.join(".git").exists() {
            return Ok(true);
        }

        // Determine base branch
        let base = if let Some(b) = base_branch {
            b.to_string()
        } else if Self::run_git_cmd(repo_dir, &["show-ref", "--verify", "--quiet", "refs/heads/master"]).is_ok() {
            "master".to_string()
        } else if Self::run_git_cmd(repo_dir, &["show-ref", "--verify", "--quiet", "refs/heads/main"]).is_ok() {
            "main".to_string()
        } else {
            "master".to_string()
        };

        if branch_name == base {
            return Ok(true);
        }

        // A branch that never got a commit still points at the base tip. It has nothing to merge,
        // so it must not count as merged (this is how an empty task branch used to pass the gate).
        // Autopilot merges with --no-ff, so a genuinely merged branch tip is never the base tip.
        if let (Ok(branch_tip), Ok(base_tip)) = (
            Self::run_git_cmd(repo_dir, &["rev-parse", branch_name]),
            Self::run_git_cmd(repo_dir, &["rev-parse", &base]),
        ) {
            if branch_tip.trim() == base_tip.trim() {
                return Ok(false);
            }
        }

        let has_remote = Self::get_remote_url(repo_dir).is_ok();

        if has_remote {
            // Fetch latest origin base and branch to sync refs
            let _ = Self::run_git_cmd(repo_dir, &["fetch", "origin", &base]);
            let _ = Self::run_git_cmd(repo_dir, &["fetch", "origin", branch_name]);

            let remote_base = format!("origin/{}", base);
            let remote_branch = format!("origin/{}", branch_name);

            // 1. Direct Ancestry Check (Standard & Fast-Forward merge)
            if Self::run_git_cmd(repo_dir, &["merge-base", "--is-ancestor", &remote_branch, &remote_base]).is_ok() {
                return Ok(true);
            }
            if Self::run_git_cmd(repo_dir, &["merge-base", "--is-ancestor", branch_name, &remote_base]).is_ok() {
                return Ok(true);
            }

            // 2. Squash & Merge / Rebase check: zero diff between origin/base and branch
            if let Ok(diff) = Self::run_git_cmd(repo_dir, &["diff", &remote_base, &remote_branch]) {
                if diff.trim().is_empty() {
                    return Ok(true);
                }
            }
            if let Ok(diff) = Self::run_git_cmd(repo_dir, &["diff", &remote_base, branch_name]) {
                if diff.trim().is_empty() {
                    return Ok(true);
                }
            }

            // 3. Remote branch deletion check (e.g. GitHub deletes branch after PR merge)
            let ls_remote = Self::run_git_cmd(repo_dir, &["ls-remote", "--heads", "origin", branch_name]);
            if let Ok(out) = ls_remote {
                if out.trim().is_empty() {
                    return Ok(true);
                }
            }

            Ok(false)
        } else {
            // Local repository check
            if Self::run_git_cmd(repo_dir, &["merge-base", "--is-ancestor", branch_name, &base]).is_ok() {
                return Ok(true);
            }
            if let Ok(diff) = Self::run_git_cmd(repo_dir, &["diff", &base, branch_name]) {
                if diff.trim().is_empty() {
                    return Ok(true);
                }
            }
            Ok(false)
        }
    }

    /// Merges a feature branch into base branch locally and pushes to origin if remote exists.
    pub fn merge_branch_locally(
        repo_dir: &Path,
        branch_name: &str,
        base_branch: Option<&str>,
    ) -> Result<String, String> {
        let base = base_branch.unwrap_or("master");
        Self::run_git_cmd(repo_dir, &["checkout", base])?;
        let _ = Self::run_git_cmd(repo_dir, &["pull", "origin", base]);
        Self::run_git_cmd(repo_dir, &["merge", branch_name, "--no-ff", "-m", &format!("Merge branch '{}' into {}", branch_name, base)])?;
        let _ = Self::run_git_cmd(repo_dir, &["push", "origin", base]);
        Ok(format!("Successfully merged '{}' into '{}'", branch_name, base))
    }
}

/// What the repo looks like after the bootstrap, for the autopilot to plan its branches around.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoBootstrap {
    pub base_branch: String,
    pub has_remote: bool,
    pub created_initial_commit: bool,
}

impl GitHubService {
    /// Makes a project ready for the autopilot, on the repo's own default branch (main, master, or any name).
    /// Steps: git init if needed; first commit if none; fetch the remote; fast-forward the base to the remote;
    /// merge diverged history into the base (local files win on conflicts); push the base.
    /// Uncommitted work on a task branch is stashed around the sync and restored afterwards.
    pub fn bootstrap_repo(repo_dir: &Path) -> Result<RepoBootstrap, String> {
        if !repo_dir.is_dir() {
            return Err("project folder does not exist".into());
        }

        if !repo_dir.join(".git").exists() {
            Self::run_git_cmd(repo_dir, &["init", "-b", "master"])?;
        }

        let mut created_initial_commit = false;
        let has_commits = Self::run_git_cmd(repo_dir, &["rev-parse", "--verify", "HEAD"]).is_ok();
        if !has_commits {
            // Keep local secrets out of the first commit
            if repo_dir.join(".env").exists() && Self::run_git_cmd(repo_dir, &["check-ignore", ".env"]).is_err() {
                use std::io::Write;
                let mut gitignore = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(repo_dir.join(".gitignore"))
                    .map_err(|e| format!("could not update .gitignore: {}", e))?;
                writeln!(gitignore, ".env").map_err(|e| e.to_string())?;
            }
            Self::run_git_cmd(repo_dir, &["symbolic-ref", "HEAD", "refs/heads/master"])?;
            Self::run_git_cmd(repo_dir, &["add", "-A"])?;
            Self::run_git_cmd(repo_dir, &["commit", "--allow-empty", "-m", "chore: initial commit"])?;
            created_initial_commit = true;
        }

        let has_remote = Self::get_remote_url(repo_dir).is_ok();
        let base = Self::default_base_branch(repo_dir, has_remote);

        if !has_remote {
            // Local only: the base just has to exist. Tasks check it out themselves.
            if !Self::branch_exists(repo_dir, &base) {
                Self::run_git_cmd(repo_dir, &["branch", base.as_str()])?;
            }
            return Ok(RepoBootstrap {
                base_branch: base,
                has_remote,
                created_initial_commit,
            });
        }

        Self::run_git_cmd(repo_dir, &["fetch", "origin"])
            .map_err(|e| format!("could not reach origin to sync '{}': {}", base, e))?;
        let remote_ref = format!("origin/{}", base);
        let remote_exists = Self::run_git_cmd(
            repo_dir,
            &["rev-parse", "--verify", "--quiet", format!("refs/remotes/{}", remote_ref).as_str()],
        )
        .is_ok();

        // Move onto the base, carrying any uncommitted work aside so nothing is lost
        let previous = Self::run_git_cmd(repo_dir, &["rev-parse", "--abbrev-ref", "HEAD"])?;
        let switched = previous != base;
        let dirty = !Self::run_git_cmd(repo_dir, &["status", "--porcelain"])?.is_empty();

        if switched {
            if dirty {
                Self::run_git_cmd(repo_dir, &["stash", "push", "-u", "-m", "orchestrator-bootstrap"])?;
            }
            if Self::branch_exists(repo_dir, &base) {
                Self::run_git_cmd(repo_dir, &["checkout", base.as_str()])?;
            } else {
                let start = if remote_exists { remote_ref.clone() } else { "HEAD".to_string() };
                Self::run_git_cmd(repo_dir, &["checkout", "-B", base.as_str(), start.as_str()])?;
            }
        }

        let sync = Self::sync_base(repo_dir, &base, remote_exists);

        // Always return to the task branch and restore its work, even if the sync failed
        if switched {
            let back = Self::run_git_cmd(repo_dir, &["checkout", previous.as_str()]);
            if dirty && back.is_ok() {
                if let Err(e) = Self::run_git_cmd(repo_dir, &["stash", "pop"]) {
                    return Err(format!(
                        "your uncommitted work is safe in the stash, but it did not restore cleanly: {}",
                        e
                    ));
                }
            }
            back?;
        }
        sync?;

        Ok(RepoBootstrap {
            base_branch: base,
            has_remote,
            created_initial_commit,
        })
    }

    /// Brings the base branch up to the remote and publishes it. The base must be checked out already.
    fn sync_base(repo_dir: &Path, base: &str, remote_exists: bool) -> Result<(), String> {
        if remote_exists {
            let remote_ref = format!("origin/{}", base);
            let local_is_behind = Self::is_ancestor(repo_dir, "HEAD", &remote_ref);
            let local_is_ahead = Self::is_ancestor(repo_dir, &remote_ref, "HEAD");

            if local_is_behind && !local_is_ahead {
                // Only behind: a clean fast-forward, nothing to merge
                Self::run_git_cmd(repo_dir, &["merge", "--ff-only", remote_ref.as_str()])
                    .map_err(|e| format!("could not fast-forward '{}' to origin: {}", base, e))?;
            } else if !local_is_ahead {
                // Diverged: join the histories. Local files win on conflicts, remote-only files are kept.
                let related = Self::run_git_cmd(repo_dir, &["merge-base", "HEAD", remote_ref.as_str()]).is_ok();
                let mut args = vec!["merge", "--no-edit", "-X", "ours"];
                if !related {
                    args.push("--allow-unrelated-histories");
                }
                args.push(remote_ref.as_str());
                if Self::run_git_cmd(repo_dir, &args).is_err() {
                    let _ = Self::run_git_cmd(repo_dir, &["merge", "--abort"]);
                    return Err(format!(
                        "could not join the remote '{}' history with the local one automatically. Nothing was pushed.",
                        base
                    ));
                }
            }
        }

        // Publish the base. A rejection here is a real problem to report, not a silent skip.
        Self::run_git_cmd(repo_dir, &["push", "-u", "origin", base])
            .map(|_| ())
            .map_err(|e| format!("push of '{}' to origin failed: {}", base, e))
    }

    /// The base branch: the remote's own default when there is a remote, otherwise a local main or master.
    fn default_base_branch(repo_dir: &Path, has_remote: bool) -> String {
        if has_remote {
            if let Ok(out) = Self::run_git_cmd(repo_dir, &["ls-remote", "--symref", "origin", "HEAD"]) {
                for line in out.lines() {
                    if let Some(rest) = line.strip_prefix("ref: refs/heads/") {
                        if let Some(name) = rest.split_whitespace().next() {
                            return name.to_string();
                        }
                    }
                }
            }
        }
        if Self::branch_exists(repo_dir, "master") || !Self::branch_exists(repo_dir, "main") {
            "master".to_string()
        } else {
            "main".to_string()
        }
    }

    fn branch_exists(repo_dir: &Path, name: &str) -> bool {
        Self::run_git_cmd(repo_dir, &["rev-parse", "--verify", "--quiet", format!("refs/heads/{}", name).as_str()])
            .is_ok()
    }

    fn is_ancestor(repo_dir: &Path, ancestor: &str, descendant: &str) -> bool {
        Self::run_git_cmd(repo_dir, &["merge-base", "--is-ancestor", ancestor, descendant]).is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_github_repo_https() {
        let url = "https://github.com/fvthakor/AI-Code-Orchestrator.git";
        let parsed = GitHubService::parse_github_repo(url);
        assert_eq!(parsed, Some(("fvthakor".to_string(), "AI-Code-Orchestrator".to_string())));
    }

    #[test]
    fn test_parse_github_repo_ssh() {
        let url = "git@github.com:fvthakor/AI-Code-Orchestrator.git";
        let parsed = GitHubService::parse_github_repo(url);
        assert_eq!(parsed, Some(("fvthakor".to_string(), "AI-Code-Orchestrator".to_string())));
    }

    #[test]
    fn test_generate_compare_url() {
        let url = GitHubService::generate_compare_url(
            "fvthakor",
            "AI-Code-Orchestrator",
            "master",
            "feat/task-1",
            "feat: test task",
            "Details here",
        );
        assert!(url.contains("https://github.com/fvthakor/AI-Code-Orchestrator/compare/master...feat/task-1?expand=1"));
        assert!(url.contains("title=feat%3A%20test%20task"));
    }
}
