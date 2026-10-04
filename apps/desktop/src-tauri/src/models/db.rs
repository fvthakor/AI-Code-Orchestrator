use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub stack_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewProject {
    pub name: String,
    pub path: String,
    pub stack_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEntity {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub custom_path: Option<String>,
    pub settings_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub agent_id: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTask {
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub agent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Execution {
    pub id: String,
    pub task_id: Option<String>,
    pub project_id: String,
    pub agent_id: Option<String>,
    pub command: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<i64>,
    pub files_changed_json: Option<String>,
    pub git_diff: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewExecution {
    pub task_id: Option<String>,
    pub project_id: String,
    pub agent_id: Option<String>,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEvent {
    pub id: i64,
    pub execution_id: String,
    pub event_type: String,
    pub payload: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSetting {
    pub key: String,
    pub value_json: String,
    pub updated_at: String,
}
