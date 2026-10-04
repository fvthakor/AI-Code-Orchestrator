use std::path::{Path, PathBuf};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCapabilities {
    pub coding: bool,
    pub terminal: bool,
    pub file_editing: bool,
    pub git: bool,
}

impl Default for AgentCapabilities {
    fn default() -> Self {
        Self {
            coding: true,
            terminal: true,
            file_editing: true,
            git: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDetectionResult {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String, // "connected" | "not_detected" | "disabled" | "error"
    pub executable_path: Option<String>,
    pub version: Option<String>,
    pub capabilities: AgentCapabilities,
    pub enabled: bool,
    pub custom_path: Option<String>,
    pub auth_configured: bool,
    pub status_message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AgentTask {
    pub id: String,
    pub title: String,
    pub description: String,
}

#[derive(Debug, Clone)]
pub struct ExecutionCommand {
    pub program: PathBuf,
    pub args: Vec<String>,
}

#[async_trait]
pub trait AgentAdapter: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;

    fn capabilities(&self) -> AgentCapabilities {
        AgentCapabilities::default()
    }

    async fn detect(&self, custom_path: Option<&str>) -> AgentDetectionResult;

    fn build_execution_command(
        &self,
        task: &AgentTask,
        project_path: &Path,
        cli_path: &Path,
    ) -> Result<ExecutionCommand, String>;
}
