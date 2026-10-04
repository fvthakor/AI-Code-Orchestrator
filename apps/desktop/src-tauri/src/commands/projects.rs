use std::path::Path;
use tauri::State;
use crate::database::DbManager;
use crate::filesystem::path_guard::PathGuard;
use crate::filesystem::scanner::ProjectScanner;
use crate::git::cli::GitService;
use crate::models::db::{NewProject, Project};
use crate::project::context::ProjectContext;

#[tauri::command]
pub async fn project_open(
    path: String,
    db: State<'_, DbManager>,
) -> Result<ProjectContext, String> {
    let canonical = PathGuard::validate_project_path(&path)?;
    let scanned = ProjectScanner::scan(&canonical)?;

    let git_ctx = if scanned.has_git {
        GitService::get_context(&canonical).ok()
    } else {
        None
    };

    let stack_json = serde_json::to_string(&scanned.stack).unwrap_or_else(|_| "{}".to_string());
    let path_str = canonical.to_string_lossy().to_string();

    let existing = db.get_project_by_path(&path_str).map_err(|e| e.to_string())?;

    let project: Project = if let Some(p) = existing {
        let _ = db.update_project_stack(&p.id, &stack_json);
        db.get_project_by_id(&p.id).map_err(|e| e.to_string())?.unwrap()
    } else {
        db.create_project(NewProject {
            name: scanned.name.clone(),
            path: path_str.clone(),
            stack_json: stack_json.clone(),
        }).map_err(|e| e.to_string())?
    };

    Ok(ProjectContext {
        id: project.id,
        name: project.name,
        path: project.path,
        stack: scanned.stack,
        git: git_ctx,
        has_git: scanned.has_git,
        created_at: project.created_at,
        updated_at: project.updated_at,
    })
}

#[tauri::command]
pub async fn project_analyze(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<ProjectContext, String> {
    let project = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let path = Path::new(&project.path);
    if !path.exists() {
        return Err(format!("Project path '{}' no longer exists", project.path));
    }

    let scanned = ProjectScanner::scan(path)?;
    let git_ctx = if scanned.has_git {
        GitService::get_context(path).ok()
    } else {
        None
    };

    let stack_json = serde_json::to_string(&scanned.stack).unwrap_or_else(|_| "{}".to_string());
    let _ = db.update_project_stack(&project.id, &stack_json);

    Ok(ProjectContext {
        id: project.id,
        name: project.name,
        path: project.path,
        stack: scanned.stack,
        git: git_ctx,
        has_git: scanned.has_git,
        created_at: project.created_at,
        updated_at: project.updated_at,
    })
}

#[tauri::command]
pub async fn project_list(db: State<'_, DbManager>) -> Result<Vec<ProjectContext>, String> {
    let projects = db.list_projects().map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for p in projects {
        let stack = serde_json::from_str(&p.stack_json).unwrap_or_default();
        let path = Path::new(&p.path);
        let has_git = path.join(".git").exists();
        let git_ctx = if has_git {
            GitService::get_context(path).ok()
        } else {
            None
        };

        result.push(ProjectContext {
            id: p.id,
            name: p.name,
            path: p.path,
            stack,
            git: git_ctx,
            has_git,
            created_at: p.created_at,
            updated_at: p.updated_at,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn project_delete(project_id: String, db: State<'_, DbManager>) -> Result<(), String> {
    db.delete_project(&project_id).map_err(|e| e.to_string())
}
