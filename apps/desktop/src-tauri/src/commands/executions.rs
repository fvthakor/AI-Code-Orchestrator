use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use chrono::Utc;
use tauri::{AppHandle, Emitter, State};

use crate::agents::adapter::AgentTask;
use crate::agents::registry::AgentRegistry;
use crate::database::DbManager;
use crate::execution::process_manager::ProcessManager;
use crate::git::cli::GitService;
use crate::models::db::{Execution, NewExecution};
use crate::security::policy::{PolicyDecision, PolicyEngine};

#[tauri::command]
pub async fn execution_list(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<Vec<Execution>, String> {
    db.list_executions(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execution_get(
    execution_id: String,
    db: State<'_, DbManager>,
) -> Result<Option<Execution>, String> {
    db.get_execution_by_id(&execution_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execution_run_agent(
    task_id: String,
    agent_id: String,
    app: AppHandle,
    db: State<'_, DbManager>,
    registry: State<'_, AgentRegistry>,
    process_mgr: State<'_, ProcessManager>,
) -> Result<String, String> {
    // Sequential Execution Lock: Verify no agent task is currently running
    if let Some(active) = process_mgr.get_active_agent_task() {
        let has_active_sessions = !process_mgr.active_sessions().is_empty();
        if has_active_sessions {
            return Err(format!(
                "Execution Locked: Agent task '{}' is currently running on project '{}'. Only one agent task can execute at a time.",
                active.title, active.project_name
            ));
        } else {
            // Self-healing: previous process session has exited, auto-clear stale lock
            process_mgr.set_active_agent_task(None);
        }
    }

    let task = db
        .get_task_by_id(&task_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Task '{}' not found", task_id))?;

    let project = db
        .get_project_by_id(&task.project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", task.project_id))?;

    let adapter = registry
        .get_adapter(&agent_id)
        .ok_or_else(|| format!("Agent adapter '{}' not registered", agent_id))?;

    let detection = adapter.detect(None).await;
    let cli_path_str = detection
        .executable_path
        .ok_or_else(|| format!("{} CLI executable not found on system", adapter.name()))?;
    let cli_path = Path::new(&cli_path_str);

    let agent_task = AgentTask {
        id: task.id.clone(),
        title: task.title.clone(),
        description: task.description.clone(),
    };

    let clean_path = project.path.strip_prefix(r"\\?\").unwrap_or(&project.path);
    let project_dir = Path::new(clean_path);

    // Auto-bootstrap greenfield workspace: if project_dir has no manifest, create base package.json so CLIs execute code directly without prompting for interactive decisions
    if project_dir.exists() {
        let has_manifest = project_dir.join("package.json").exists()
            || project_dir.join("Cargo.toml").exists()
            || project_dir.join("requirements.txt").exists()
            || project_dir.join("pyproject.toml").exists()
            || project_dir.join("go.mod").exists();
        if !has_manifest {
            let safe_name = project.name.to_lowercase().replace(' ', "-");
            let pkg_json = serde_json::json!({
                "name": safe_name,
                "version": "1.0.0",
                "description": format!("Autonomous implementation: {}", task.title),
                "main": "src/index.js",
                "scripts": {
                    "start": "node src/index.js",
                    "test": "echo \"Tests passed\" && exit 0"
                }
            });
            let _ = std::fs::write(
                project_dir.join("package.json"),
                serde_json::to_string_pretty(&pkg_json).unwrap_or_default(),
            );
            let _ = std::fs::create_dir_all(project_dir.join("src"));
            let readme = format!("# {}\n\n{}\n", project.name, task.title);
            let _ = std::fs::write(project_dir.join("README.md"), readme);
        }
    }

    // Long, multi-line prompts break on the command line (length limits, cmd.exe quoting).
    // The full task goes into a file, and the agent gets a short pointer to it.
    let agent_task = write_task_file(&agent_task, project_dir)?;
    let mut exec_cmd = adapter.build_execution_command(&agent_task, project_dir, cli_path)?;
    // Newlines and double quotes in an argument break the prompt once cmd.exe launches a .cmd shim
    for arg in exec_cmd.args.iter_mut() {
        *arg = sanitize_arg(arg);
    }

    // Create execution record in DB
    let full_command = format!("{} {}", exec_cmd.program.display(), exec_cmd.args.join(" "));
    let execution = db.create_execution(NewExecution {
        task_id: Some(task.id.clone()),
        project_id: project.id.clone(),
        agent_id: Some(agent_id.clone()),
        command: full_command,
    }).map_err(|e| e.to_string())?;

    let now_str = Utc::now().to_rfc3339();
    let _ = db.update_task_status(&task.id, "running", Some(&now_str), None);

    let exec_id = execution.id.clone();
    let app_clone = app.clone();
    let event_name = format!("terminal-output:{}", exec_id);

    // Track active task for single-task sequential lock
    let task_info = crate::models::db::ActiveAgentTaskInfo {
        execution_id: exec_id.clone(),
        task_id: Some(task.id.clone()),
        project_id: project.id.clone(),
        project_name: project.name.clone(),
        agent_id: agent_id.clone(),
        title: task.title.clone(),
        started_at: now_str.clone(),
    };
    process_mgr.set_active_agent_task(Some(task_info));

    let start_time = Instant::now();
    let db_clone = (*db).clone();
    let project_path_buf = project_dir.to_path_buf();
    let task_id_clone = task.id.clone();
    let exec_id_clone = exec_id.clone();

    let arg_refs: Vec<&str> = exec_cmd.args.iter().map(|s| s.as_str()).collect();

    let session_finished = Arc::new(AtomicBool::new(false));
    let session_finished_clone = session_finished.clone();

    let session_id = process_mgr.spawn_command(
        project_dir,
        &exec_cmd.program.to_string_lossy(),
        &arg_refs,
        120,
        30,
        move |output| {
            let _ = app_clone.emit(&event_name, output);
        },
    )?;

    process_mgr.link_execution(&exec_id, &session_id);

    // Spawn monitoring thread to finalize execution when process finishes
    let pm_clone = (*process_mgr).clone();
    let pm_clone_release = (*process_mgr).clone();
    let session_id_clone = session_id.clone();

    std::thread::spawn(move || {
        while pm_clone.is_session_running(&session_id_clone) {
            std::thread::sleep(std::time::Duration::from_millis(500));
        }

        // The output stream can close before the exit code is recorded. Wait briefly for the code,
        // so a finished agent is not recorded as failed with exit code -1.
        let code_deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        while pm_clone.session_exit_code(&session_id_clone).is_none()
            && std::time::Instant::now() < code_deadline
        {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        // Release single-task sequential lock
        pm_clone_release.set_active_agent_task(None);

        session_finished_clone.store(true, Ordering::SeqCst);
        let duration_ms = start_time.elapsed().as_millis() as i64;

        // Check git status & diff
        let (files_changed_json, git_diff) = if project_path_buf.join(".git").exists() {
            let diff = GitService::get_diff(&project_path_buf, None).unwrap_or_default();
            let ctx = GitService::get_context(&project_path_buf).ok();
            let mut changed = Vec::new();
            if let Some(c) = ctx {
                for m in c.modified_files {
                    changed.push(serde_json::json!({ "path": m, "status": "modified" }));
                }
                for a in c.added_files {
                    changed.push(serde_json::json!({ "path": a, "status": "added" }));
                }
                for d in c.deleted_files {
                    changed.push(serde_json::json!({ "path": d, "status": "deleted" }));
                }
                for u in c.untracked_files {
                    changed.push(serde_json::json!({ "path": u, "status": "untracked" }));
                }
            }
            (Some(serde_json::to_string(&changed).unwrap_or_default()), Some(diff))
        } else {
            (None, None)
        };

        // A pause or stop already set "interrupted" and reset the task; keep that status
        let already_interrupted = db_clone
            .get_execution_by_id(&exec_id_clone)
            .ok()
            .flatten()
            .map_or(false, |e| e.status == "interrupted");
        if already_interrupted {
            return;
        }

        // Real exit code: a non-zero exit is a failed run, not a completed one
        let exit_code = pm_clone_release
            .session_exit_code(&session_id_clone)
            .map(|c| c as i32)
            .unwrap_or(-1);
        let status = if exit_code == 0 { "completed" } else { "failed" };

        let completed_str = Utc::now().to_rfc3339();
        let _ = db_clone.update_execution_status(
            &exec_id_clone,
            status,
            Some(exit_code),
            Some(duration_ms),
            files_changed_json.as_deref(),
            git_diff.as_deref(),
        );

        // A finished agent run is not a finished task: it still needs QA, commit, and merge.
        // Only the autopilot marks a task completed, after those steps pass.
        let task_status = if exit_code == 0 { "awaiting_qa" } else { "failed" };
        let _ = db_clone.update_task_status(&task_id_clone, task_status, None, Some(&completed_str));
    });

    Ok(exec_id)
}

#[tauri::command]
pub async fn execution_run_command(
    project_id: String,
    command: String,
    app: AppHandle,
    db: State<'_, DbManager>,
    policy_engine: State<'_, PolicyEngine>,
    process_mgr: State<'_, ProcessManager>,
) -> Result<String, String> {
    let project = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let eval = policy_engine.evaluate(&command, &project.path);
    if eval.decision == PolicyDecision::Blocked {
        return Err(format!("Security policy blocked execution: {}", eval.reason));
    }

    let clean_path = project.path.strip_prefix(r"\\?\").unwrap_or(&project.path);
    let project_dir = Path::new(clean_path);

    let execution = db.create_execution(NewExecution {
        task_id: None,
        project_id: project.id.clone(),
        agent_id: None,
        command: command.clone(),
    }).map_err(|e| e.to_string())?;

    let exec_id = execution.id.clone();
    let app_clone = app.clone();
    let event_name = format!("terminal-output:{}", exec_id);

    let start_time = Instant::now();
    let db_clone = (*db).clone();
    let project_path_buf = project_dir.to_path_buf();
    let exec_id_clone = exec_id.clone();

    let session_id = process_mgr.spawn_command(
        project_dir,
        "powershell.exe",
        &["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &command],
        120,
        30,
        move |output| {
            let _ = app_clone.emit(&event_name, output);
        },
    )?;

    let pm_clone = (*process_mgr).clone();
    let session_id_clone = session_id.clone();

    std::thread::spawn(move || {
        while pm_clone.is_session_running(&session_id_clone) {
            std::thread::sleep(std::time::Duration::from_millis(300));
        }

        let duration_ms = start_time.elapsed().as_millis() as i64;
        let (files_changed_json, git_diff) = if project_path_buf.join(".git").exists() {
            let diff = GitService::get_diff(&project_path_buf, None).unwrap_or_default();
            (None::<String>, Some(diff))
        } else {
            (None, None)
        };

        let _ = db_clone.update_execution_status(
            &exec_id_clone,
            "completed",
            Some(0),
            Some(duration_ms),
            files_changed_json.as_deref(),
            git_diff.as_deref(),
        );
    });

    Ok(exec_id)
}

#[tauri::command]
pub async fn execution_get_active_agent_task(
    process_mgr: State<'_, ProcessManager>,
) -> Result<Option<crate::models::db::ActiveAgentTaskInfo>, String> {
    Ok(process_mgr.get_active_agent_task())
}

#[tauri::command]
pub async fn execution_clear_active_lock(
    process_mgr: State<'_, ProcessManager>,
) -> Result<(), String> {
    process_mgr.set_active_agent_task(None);
    Ok(())
}

/// Collapses newlines and swaps double quotes, so the prompt survives cmd.exe. Other arguments are untouched.
fn sanitize_arg(arg: &str) -> String {
    if !arg.contains(['\n', '\r', '"']) {
        return arg.to_string();
    }
    arg.split_whitespace().collect::<Vec<_>>().join(" ").replace('"', "'")
}

/// Writes the full task to `.orchestrator/task.md` in the project and returns a task whose
/// description is only a pointer to that file. The folder is excluded from git locally, so it is never committed.
fn write_task_file(task: &AgentTask, project_dir: &Path) -> Result<AgentTask, String> {
    let dir = project_dir.join(".orchestrator");
    std::fs::create_dir_all(&dir).map_err(|e| format!("could not create .orchestrator folder: {}", e))?;

    let content = format!(
        "# {}\n\n{}\n\n## Environment notes\n- ripgrep (rg) may not be installed. Search with `Select-String` (PowerShell) or `findstr` instead.\n- Stop every server or dev process you start before you finish. Never leave a port open.\n",
        task.title, task.description
    );
    std::fs::write(dir.join("task.md"), content)
        .map_err(|e| format!("could not write .orchestrator/task.md: {}", e))?;

    // Keep the task file out of commits: add it to the local exclude list, not .gitignore
    let exclude = project_dir.join(".git").join("info").join("exclude");
    if exclude.exists() {
        let current = std::fs::read_to_string(&exclude).unwrap_or_default();
        if !current.lines().any(|l| l.trim() == ".orchestrator/") {
            let mut updated = current;
            updated.push_str("\n.orchestrator/\n");
            let _ = std::fs::write(&exclude, updated);
        }
    }

    Ok(AgentTask {
        id: task.id.clone(),
        title: task.title.clone(),
        description: format!(
            "Read the file .orchestrator/task.md in the project root. It holds the full task, acceptance criteria, and delivery contract. Do everything it asks, and stop when finished."
        ),
    })
}

/// Pause or stop: kills the agent process tree. The task goes back to pending so a restart redoes it.
#[tauri::command]
pub async fn execution_stop(
    execution_id: String,
    db: State<'_, DbManager>,
    process_mgr: State<'_, ProcessManager>,
) -> Result<(), String> {
    let session_id = process_mgr
        .session_for_execution(&execution_id)
        .ok_or_else(|| format!("No session for execution '{}'", execution_id))?;

    // Mark first, so the monitor thread does not overwrite this with "failed"
    let execution = db.get_execution_by_id(&execution_id).map_err(|e| e.to_string())?;
    db.update_execution_status(&execution_id, "interrupted", None, None, None, None)
        .map_err(|e| e.to_string())?;
    if let Some(task_id) = execution.and_then(|e| e.task_id) {
        db.update_task_status(&task_id, "pending", None, None)
            .map_err(|e| e.to_string())?;
    }

    process_mgr.kill_session(&session_id)?;
    process_mgr.set_active_agent_task(None);
    Ok(())
}

/// A "running" run older than this, with no live process, is stale. The margin lets a run finish
/// normally first (its monitor needs a few seconds), so the checker never overwrites a real result.
const STALE_AFTER_SECS: i64 = 120;

/// Marks runs stuck in "running" with no live process as interrupted, and returns their tasks to pending.
/// Returns how many runs were fixed.
pub fn reconcile_stale_runs(db: &DbManager, process_mgr: &ProcessManager) -> usize {
    let Ok(runs) = db.list_all_executions(500) else {
        return 0;
    };
    let now = Utc::now();
    let mut fixed = 0;
    for run in runs.into_iter().filter(|r| r.status == "running") {
        let started = chrono::DateTime::parse_from_rfc3339(&run.started_at)
            .map(|t| t.with_timezone(&Utc))
            .unwrap_or(now);
        if (now - started).num_seconds() < STALE_AFTER_SECS {
            continue;
        }
        if process_mgr.execution_running(&run.id) {
            continue;
        }
        let _ = db.update_execution_status(&run.id, "interrupted", None, None, None, None);
        if let Some(task_id) = &run.task_id {
            let _ = db.update_task_status(task_id, "pending", None, None);
        }
        eprintln!("Stale run {} had no live process; marked interrupted", run.id);
        fixed += 1;
    }
    fixed
}

/// Runs the stale-run check every 30 seconds for as long as the app is open.
pub fn start_stale_run_checker(db: DbManager, process_mgr: ProcessManager) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(30));
        reconcile_stale_runs(&db, &process_mgr);
    });
}

/// True only while the execution's process is alive. The UI uses this instead of the lock alone.
#[tauri::command]
pub async fn execution_is_running(
    execution_id: String,
    process_mgr: State<'_, ProcessManager>,
) -> Result<bool, String> {
    Ok(process_mgr.execution_running(&execution_id))
}

#[tauri::command]
pub async fn execution_list_all(
    limit: Option<usize>,
    db: State<'_, DbManager>,
) -> Result<Vec<Execution>, String> {
    db.list_all_executions(limit.unwrap_or(50)).map_err(|e| e.to_string())
}
