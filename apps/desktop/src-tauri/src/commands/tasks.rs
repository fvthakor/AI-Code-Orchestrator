use tauri::State;
use crate::database::DbManager;
use crate::models::db::{NewTask, Task};

#[tauri::command]
pub async fn task_create(
    project_id: String,
    title: String,
    description: String,
    agent_id: Option<String>,
    db: State<'_, DbManager>,
) -> Result<Task, String> {
    db.create_task(NewTask {
        project_id,
        title,
        description,
        agent_id,
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn task_list(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<Vec<Task>, String> {
    db.list_tasks(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn task_get(
    task_id: String,
    db: State<'_, DbManager>,
) -> Result<Option<Task>, String> {
    db.get_task_by_id(&task_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn task_update_status(
    task_id: String,
    status: String,
    db: State<'_, DbManager>,
) -> Result<(), String> {
    db.update_task_status(&task_id, &status, None, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn task_delete(
    task_id: String,
    db: State<'_, DbManager>,
) -> Result<(), String> {
    db.delete_task(&task_id).map_err(|e| e.to_string())
}
