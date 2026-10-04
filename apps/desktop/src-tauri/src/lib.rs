pub mod models;
pub mod database;
pub mod filesystem;
pub mod project;
pub mod execution;
pub mod agents;
pub mod git;
pub mod security;
pub mod commands;

use std::env;
use std::path::PathBuf;

use database::DbManager;
use execution::process_manager::ProcessManager;
use agents::registry::AgentRegistry;
use security::policy::PolicyEngine;

use commands::projects::{project_open, project_analyze, project_list, project_delete};
use commands::agents::{agent_detect_all, agent_save_config, agent_test_connection};
use commands::tasks::{task_create, task_list, task_get, task_update_status, task_delete};
use commands::executions::{execution_list, execution_get, execution_run_agent, execution_run_command};
use commands::terminal::{terminal_spawn, terminal_write, terminal_resize, terminal_kill};
use commands::git::{git_status, git_diff, git_log, git_commit};
use commands::security::security_evaluate;

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
            // Projects
            project_open,
            project_analyze,
            project_list,
            project_delete,
            // Agents
            agent_detect_all,
            agent_save_config,
            agent_test_connection,
            // Tasks
            task_create,
            task_list,
            task_get,
            task_update_status,
            task_delete,
            // Executions
            execution_list,
            execution_get,
            execution_run_agent,
            execution_run_command,
            // Terminal
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill,
            // Git
            git_status,
            git_diff,
            git_log,
            git_commit,
            // Security
            security_evaluate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
