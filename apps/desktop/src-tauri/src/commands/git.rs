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

#[tauri::command]
pub async fn git_init_or_link(
    project_id: String,
    remote_url: Option<String>,
    default_branch: Option<String>,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::init_or_link_repo(
        Path::new(&p.path),
        remote_url.as_deref(),
        default_branch.as_deref(),
    )
}

#[tauri::command]
pub async fn git_create_branch(
    project_id: String,
    branch_name: String,
    db: State<'_, DbManager>,
) -> Result<(), String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::checkout_branch(Path::new(&p.path), &branch_name)
}

#[tauri::command]
pub async fn git_push(
    project_id: String,
    branch_name: String,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::push_branch(Path::new(&p.path), &branch_name)
}

#[tauri::command]
pub async fn git_create_pr(
    request: crate::models::db::GitHubPrRequest,
    db: State<'_, DbManager>,
) -> Result<crate::models::db::GitHubPrResult, String> {
    let p = db
        .get_project_by_id(&request.project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", request.project_id))?;

    // Check if user saved a GitHub PAT in settings
    let pat_token = db.get_setting("github_pat").ok().flatten();

    crate::git::github::GitHubService::create_pr(
        Path::new(&p.path),
        &request.branch_name,
        request.base_branch.as_deref(),
        &request.title,
        &request.body,
        pat_token.as_deref(),
        request.github_repo_url.as_deref(),
    )
}

#[tauri::command]
pub async fn git_prepare_task_branch(
    project_id: String,
    task_slug: String,
    base_branch: Option<String>,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::prepare_task_branch(
        Path::new(&p.path),
        &task_slug,
        base_branch.as_deref(),
    )
}

#[tauri::command]
pub async fn git_commit_and_push(
    project_id: String,
    branch_name: String,
    message: String,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::commit_and_push(
        Path::new(&p.path),
        &branch_name,
        &message,
    )
}

#[tauri::command]
pub async fn git_resume_task_branch(
    project_id: String,
    branch_name: String,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::resume_task_branch(Path::new(&p.path), &branch_name)
}

/// Prepares the project's repo for the autopilot: git init if needed, first commit, base branch, push.
#[tauri::command]
pub async fn git_bootstrap_repo(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<crate::git::github::RepoBootstrap, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::bootstrap_repo(Path::new(&p.path))
}

#[tauri::command]
pub async fn git_is_branch_merged(
    project_id: String,
    branch_name: String,
    base_branch: Option<String>,
    db: State<'_, DbManager>,
) -> Result<bool, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::is_branch_merged(
        Path::new(&p.path),
        &branch_name,
        base_branch.as_deref(),
    )
}

#[tauri::command]
pub async fn git_merge_branch_locally(
    project_id: String,
    branch_name: String,
    base_branch: Option<String>,
    db: State<'_, DbManager>,
) -> Result<String, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    crate::git::github::GitHubService::merge_branch_locally(
        Path::new(&p.path),
        &branch_name,
        base_branch.as_deref(),
    )
}

