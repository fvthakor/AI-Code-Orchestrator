use std::path::Path;
use tauri::{AppHandle, Emitter, State};

use crate::database::DbManager;
use crate::execution::process_manager::ProcessManager;

#[tauri::command]
pub async fn terminal_spawn(
    project_id: Option<String>,
    cols: u16,
    rows: u16,
    app: AppHandle,
    db: State<'_, DbManager>,
    process_mgr: State<'_, ProcessManager>,
) -> Result<String, String> {
    let working_dir = if let Some(pid) = project_id {
        let p = db
            .get_project_by_id(&pid)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Project '{}' not found", pid))?;
        Path::new(&p.path).to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_else(|_| Path::new("C:\\").to_path_buf())
    };

    let app_clone = app.clone();
    let session_id_holder = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let sid_for_closure = session_id_holder.clone();

    let session_id = process_mgr.spawn_command(
        &working_dir,
        "powershell.exe",
        &["-NoProfile", "-ExecutionPolicy", "Bypass"],
        cols,
        rows,
        move |output| {
            let sid = sid_for_closure.lock().unwrap().clone();
            if !sid.is_empty() {
                let event = format!("terminal-output:{}", sid);
                let _ = app_clone.emit(&event, output);
            }
        },
    )?;

    *session_id_holder.lock().unwrap() = session_id.clone();
    Ok(session_id)
}

#[tauri::command]
pub async fn terminal_write(
    session_id: String,
    data: String,
    process_mgr: State<'_, ProcessManager>,
) -> Result<(), String> {
    process_mgr.write_input(&session_id, data.as_bytes())
}

#[tauri::command]
pub async fn terminal_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    process_mgr: State<'_, ProcessManager>,
) -> Result<(), String> {
    process_mgr.resize(&session_id, cols, rows)
}

#[tauri::command]
pub async fn terminal_kill(
    session_id: String,
    process_mgr: State<'_, ProcessManager>,
) -> Result<(), String> {
    process_mgr.kill_session(&session_id)
}
