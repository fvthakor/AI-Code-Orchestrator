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
