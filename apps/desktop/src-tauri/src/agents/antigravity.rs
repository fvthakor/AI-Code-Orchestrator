use std::env;
use std::path::{Path, PathBuf};
use async_trait::async_trait;

use super::adapter::{AgentAdapter, AgentCapabilities, AgentDetectionResult, AgentTask, ExecutionCommand};
use super::resolver::WindowsExecutableResolver;

pub struct AntigravityAdapter;

impl Default for AntigravityAdapter {
    fn default() -> Self {
        Self
    }
}

#[async_trait]
impl AgentAdapter for AntigravityAdapter {
    fn id(&self) -> &'static str {
        "antigravity"
    }

    fn name(&self) -> &'static str {
        "Antigravity (AGY)"
    }

    fn description(&self) -> &'static str {
        "Google DeepMind Antigravity autonomous coding agent CLI"
    }

    fn capabilities(&self) -> AgentCapabilities {
        AgentCapabilities {
            coding: true,
            terminal: true,
            file_editing: true,
            git: true,
        }
    }

    async fn detect(&self, custom_path: Option<&str>) -> AgentDetectionResult {
        let exe_path = if let Some(p) = custom_path {
            WindowsExecutableResolver::resolve_binary(p)
        } else {
            // Check agy first, then antigravity
            WindowsExecutableResolver::resolve_binary("agy")
                .or_else(|| WindowsExecutableResolver::resolve_binary("antigravity"))
        };

        let mut status = "not_detected".to_string();
        let mut version = None;
        let mut auth_configured = false;
        let mut status_message = None;

        if let Some(ref path) = exe_path {
            version = WindowsExecutableResolver::get_version(path, "--version");
            if version.is_some() {
                status = "connected".to_string();
            } else {
                status = "error".to_string();
                status_message = Some("Executable found but failed to report version".to_string());
            }

            // Safe auth check without extracting tokens
            if let Ok(home) = env::var("USERPROFILE") {
                let home_path = PathBuf::from(home);
                if home_path.join(".gemini").exists() || home_path.join(".antigravity").exists() {
                    auth_configured = true;
                }
            }
        } else {
            status_message = Some("Antigravity CLI (agy) not found in PATH or custom location".to_string());
        }

        AgentDetectionResult {
            id: self.id().to_string(),
            name: self.name().to_string(),
            description: self.description().to_string(),
            status,
            executable_path: exe_path.map(|p| p.to_string_lossy().to_string()),
            version,
            capabilities: self.capabilities(),
            enabled: true,
            custom_path: custom_path.map(|s| s.to_string()),
            auth_configured,
            status_message,
        }
    }

    fn build_execution_command(
        &self,
        task: &AgentTask,
        _project_path: &Path,
        cli_path: &Path,
    ) -> Result<ExecutionCommand, String> {
        let prompt = if task.description.trim().is_empty() {
            task.title.clone()
        } else {
            format!("{}: {}", task.title, task.description)
        };

        let file_stem = cli_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        let args = if file_stem.contains("antigravity") {
            vec!["chat".to_string(), prompt]
        } else {
            vec![
                "--print".to_string(),
                "--dangerously-skip-permissions".to_string(),
                prompt,
            ]
        };

        Ok(ExecutionCommand {
            program: cli_path.to_path_buf(),
            args,
        })
    }
}
