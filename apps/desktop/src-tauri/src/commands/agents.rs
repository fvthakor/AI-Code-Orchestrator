use tauri::State;
use crate::agents::adapter::AgentDetectionResult;
use crate::agents::registry::AgentRegistry;
use crate::database::DbManager;
use crate::models::db::AgentEntity;

#[tauri::command]
pub async fn agent_detect_all(
    registry: State<'_, AgentRegistry>,
    db: State<'_, DbManager>,
) -> Result<Vec<AgentDetectionResult>, String> {
    Ok(registry.detect_all(Some(&db)).await)
}

#[tauri::command]
pub async fn agent_save_config(
    id: String,
    name: String,
    enabled: bool,
    custom_path: Option<String>,
    settings_json: Option<String>,
    db: State<'_, DbManager>,
) -> Result<(), String> {
    let entity = AgentEntity {
        id,
        name,
        enabled,
        custom_path,
        settings_json: settings_json.unwrap_or_else(|| "{}".to_string()),
    };
    db.upsert_agent(&entity).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn agent_test_connection(
    agent_id: String,
    custom_path: Option<String>,
    registry: State<'_, AgentRegistry>,
) -> Result<AgentDetectionResult, String> {
    let adapter = registry
        .get_adapter(&agent_id)
        .ok_or_else(|| format!("Unknown agent adapter: {}", agent_id))?;

    Ok(adapter.detect(custom_path.as_deref()).await)
}
