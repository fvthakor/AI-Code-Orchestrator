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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamWorkflow {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub goal: String,
    pub is_greenfield: bool,
    pub phase: String,
    pub plan_manager_agent_id: String,
    pub plan_manager_fallback: Option<String>,
    pub developer_agent_id: String,
    pub developer_fallback: Option<String>,
    pub tester_agent_id: String,
    pub tester_fallback: Option<String>,
    pub branch_name: Option<String>,
    pub pr_url: Option<String>,
    pub pr_method: Option<String>,
    pub current_step_index: i32,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTeamWorkflow {
    pub project_id: String,
    pub title: String,
    pub goal: String,
    pub is_greenfield: bool,
    pub plan_manager_agent_id: String,
    pub plan_manager_fallback: Option<String>,
    pub developer_agent_id: String,
    pub developer_fallback: Option<String>,
    pub tester_agent_id: String,
    pub tester_fallback: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamWorkflowStep {
    pub id: String,
    pub workflow_id: String,
    pub step_number: i32,
    pub title: String,
    pub description: String,
    pub assigned_role: String,
    pub assigned_agent_id: String,
    pub fallback_agent_used: Option<String>,
    pub status: String,
    pub retry_count: i32,
    pub test_command: Option<String>,
    pub verification_report: Option<String>,
    pub error_log: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTeamWorkflowStep {
    pub workflow_id: String,
    pub step_number: i32,
    pub title: String,
    pub description: String,
    pub assigned_role: String,
    pub assigned_agent_id: String,
    pub fallback_agent_used: Option<String>,
    pub test_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPrRequest {
    pub project_id: String,
    pub branch_name: String,
    pub base_branch: Option<String>,
    pub title: String,
    pub body: String,
    pub github_repo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubPrResult {
    pub pr_url: String,
    pub method: String,
    pub is_web_fallback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveAgentTaskInfo {
    pub execution_id: String,
    pub task_id: Option<String>,
    pub project_id: String,
    pub project_name: String,
    pub agent_id: String,
    pub title: String,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalStats {
    pub total_projects: usize,
    pub total_tasks: usize,
    pub completed_tasks: usize,
    pub total_executions: usize,
    pub total_workflows: usize,
    pub completed_workflows: usize,
    pub total_prs: usize,
    pub active_task: Option<ActiveAgentTaskInfo>,
}
