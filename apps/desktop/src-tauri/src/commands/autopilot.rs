use tauri::State;

use crate::database::DbManager;

fn state_key(project_id: &str) -> String {
    format!("autopilot_run:{}", project_id)
}

/// Saves the autopilot run checkpoint (JSON) for a project. Survives app restarts.
#[tauri::command]
pub async fn autopilot_save_state(
    project_id: String,
    state_json: String,
    db: State<'_, DbManager>,
) -> Result<(), String> {
    db.set_setting(&state_key(&project_id), &state_json)
        .map_err(|e| e.to_string())
}

/// Loads the last autopilot checkpoint for a project, if any.
#[tauri::command]
pub async fn autopilot_load_state(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<Option<String>, String> {
    db.get_setting(&state_key(&project_id)).map_err(|e| e.to_string())
}
