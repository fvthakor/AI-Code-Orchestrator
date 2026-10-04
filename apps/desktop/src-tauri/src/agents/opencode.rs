use std::path::Path;
use async_trait::async_trait;

use super::adapter::{AgentAdapter, AgentCapabilities, AgentDetectionResult, AgentTask, ExecutionCommand};
use super::resolver::WindowsExecutableResolver;

pub struct OpenCodeAdapter;

impl Default for OpenCodeAdapter {
    fn default() -> Self {
        Self
    }
}

#[async_trait]
impl AgentAdapter for OpenCodeAdapter {
    fn id(&self) -> &'static str {
        "opencode"
    }

    fn name(&self) -> &'static str {
        "OpenCode"
    }

    fn description(&self) -> &'static str {
        "OpenCode AI coding CLI assistant"
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
            WindowsExecutableResolver::resolve_binary("opencode")
        };

        let mut status = "not_detected".to_string();
        let mut version = None;
        let mut status_message = None;

        if let Some(ref path) = exe_path {
            version = WindowsExecutableResolver::get_version(path, "--version");
            if version.is_some() {
                status = "connected".to_string();
            } else {
                status = "error".to_string();
                status_message = Some("Executable found but failed to report version".to_string());
            }
        } else {
            status_message = Some("OpenCode CLI not found in PATH or custom location".to_string());
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
            auth_configured: true,
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

        Ok(ExecutionCommand {
            program: cli_path.to_path_buf(),
            args: vec!["run".to_string(), prompt],
        })
    }
}
