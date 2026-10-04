use tauri::State;
use crate::database::DbManager;
use crate::models::db::{NewTeamWorkflowStep, TeamWorkflow, TeamWorkflowStep};
use crate::team::coordinator::TeamCoordinator;

#[tauri::command]
pub async fn team_start_workflow(
    project_id: String,
    title: String,
    goal: String,
    is_greenfield: bool,
    plan_manager_agent_id: String,
    developer_agent_id: String,
    tester_agent_id: String,
    db: State<'_, DbManager>,
) -> Result<TeamWorkflow, String> {
    TeamCoordinator::start_workflow(
        &db,
        project_id,
        title,
        goal,
        is_greenfield,
        plan_manager_agent_id,
        developer_agent_id,
        tester_agent_id,
    )
}

#[tauri::command]
pub async fn team_get_workflow(
    workflow_id: String,
    db: State<'_, DbManager>,
) -> Result<Option<TeamWorkflow>, String> {
    db.get_team_workflow_by_id(&workflow_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn team_list_workflows(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<Vec<TeamWorkflow>, String> {
    db.list_team_workflows(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn team_list_workflow_steps(
    workflow_id: String,
    db: State<'_, DbManager>,
) -> Result<Vec<TeamWorkflowStep>, String> {
    db.list_team_workflow_steps(&workflow_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn team_add_step(
    workflow_id: String,
    step_number: i32,
    title: String,
    description: String,
    assigned_role: String,
    assigned_agent_id: String,
    test_command: Option<String>,
    db: State<'_, DbManager>,
) -> Result<TeamWorkflowStep, String> {
    db.create_team_workflow_step(NewTeamWorkflowStep {
        workflow_id,
        step_number,
        title,
        description,
        assigned_role,
        assigned_agent_id,
        test_command,
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn team_advance_step(
    workflow_id: String,
    step_id: String,
    status: String,
    verification_report: Option<String>,
    error_log: Option<String>,
    db: State<'_, DbManager>,
) -> Result<TeamWorkflow, String> {
    TeamCoordinator::advance_step(
        &db,
        &workflow_id,
        &step_id,
        &status,
        verification_report.as_deref(),
        error_log.as_deref(),
    )
}

#[tauri::command]
pub async fn team_retry_step(
    workflow_id: String,
    step_id: String,
    db: State<'_, DbManager>,
) -> Result<TeamWorkflowStep, String> {
    TeamCoordinator::retry_step(&db, &workflow_id, &step_id)
}
