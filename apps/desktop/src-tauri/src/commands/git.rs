use std::path::Path;
use tauri::State;

use crate::database::DbManager;
use crate::git::cli::{GitCommitInfo, GitService};
use crate::project::context::GitContext;

#[tauri::command]
pub async fn git_status(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<GitContext, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    GitService::get_context(Path::new(&p.path))
}

#[tauri::command]
pub async fn git_diff(
    project_id: String,
    file: Option<String>,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    GitService::get_diff(Path::new(&p.path), file.as_deref())
}

#[tauri::command]
pub async fn git_log(
    project_id: String,
    count: Option<usize>,
    db: State<'_, DbManager>,
) -> Result<Vec<GitCommitInfo>, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    GitService::get_log(Path::new(&p.path), count.unwrap_or(20))
}

#[tauri::command]
pub async fn git_commit(
    project_id: String,
    message: String,
    files: Option<Vec<String>>,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let file_refs: Option<Vec<&str>> = files.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
    GitService::stage_and_commit(Path::new(&p.path), file_refs.as_deref(), &message)
}
