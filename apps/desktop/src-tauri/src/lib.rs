pub mod models;
pub mod database;
pub mod filesystem;
pub mod project;
pub mod execution;
pub mod agents;
pub mod git;
pub mod security;
pub mod team;
pub mod commands;

use std::env;
use std::path::PathBuf;

use database::DbManager;
use execution::process_manager::ProcessManager;
use agents::registry::AgentRegistry;
use security::policy::PolicyEngine;

use commands::projects::{project_open, project_analyze, project_list, project_delete, stats_get_global};
use commands::agents::{agent_detect_all, agent_save_config, agent_test_connection};
use commands::tasks::{task_create, task_list, task_list_all, task_get, task_update_status, task_delete};
use commands::executions::{execution_list, execution_list_all, execution_get, execution_get_active_agent_task, execution_run_agent, execution_run_command};
use commands::terminal::{terminal_spawn, terminal_write, terminal_resize, terminal_kill};
use commands::git::{git_status, git_diff, git_log, git_commit, git_init_or_link, git_create_branch, git_push, git_create_pr, git_prepare_task_branch, git_commit_and_push};
use commands::security::security_evaluate;
use commands::team::{team_start_workflow, team_get_workflow, team_list_workflows, team_list_all_workflows, team_list_workflow_steps, team_add_step, team_advance_step, team_retry_step, team_trigger_fallback};

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

pub fn run() {
    let db_path = if let Ok(appdata) = env::var("APPDATA") {
        PathBuf::from(appdata).join("AI-Code-Orchestrator").join("orchestrator.db")
    } else {
        PathBuf::from("orchestrator.db")
    };

    let db_manager = DbManager::new(&db_path).expect("Failed to initialize SQLite database");
    let process_manager = ProcessManager::new();
    let agent_registry = AgentRegistry::new();
    let policy_engine = PolicyEngine::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(db_manager)
        .manage(process_manager)
        .manage(agent_registry)
        .manage(policy_engine)
        .invoke_handler(tauri::generate_handler![
            ping,
            // Projects & Stats
            project_open,
            project_analyze,
            project_list,
            project_delete,
            stats_get_global,
            // Agents
            agent_detect_all,
            agent_save_config,
            agent_test_connection,
            // Tasks
            task_create,
            task_list,
            task_list_all,
            task_get,
            task_update_status,
            task_delete,
            // Executions
            execution_list,
            execution_list_all,
            execution_get,
            execution_get_active_agent_task,
            execution_run_agent,
            execution_run_command,
            // Terminal
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill,
            // Git & GitHub
            git_status,
            git_diff,
            git_log,
            git_commit,
            git_init_or_link,
            git_create_branch,
            git_push,
            git_create_pr,
            git_prepare_task_branch,
            git_commit_and_push,
            // Security
            security_evaluate,
            // Team Orchestration
            team_start_workflow,
            team_get_workflow,
            team_list_workflows,
            team_list_all_workflows,
            team_list_workflow_steps,
            team_add_step,
            team_advance_step,
            team_retry_step,
            team_trigger_fallback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
