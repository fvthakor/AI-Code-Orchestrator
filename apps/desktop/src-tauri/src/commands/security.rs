use tauri::State;
use crate::database::DbManager;
use crate::security::policy::{PolicyEngine, PolicyEvaluation};

#[tauri::command]
pub async fn security_evaluate(
    command: String,
    project_id: Option<String>,
    db: State<'_, DbManager>,
    policy_engine: State<'_, PolicyEngine>,
) -> Result<PolicyEvaluation, String> {
    let working_dir = if let Some(pid) = project_id {
        db.get_project_by_id(&pid)
            .map_err(|e| e.to_string())?
            .map(|p| p.path)
            .unwrap_or_default()
    } else {
        String::new()
    };

    Ok(policy_engine.evaluate(&command, &working_dir))
}
