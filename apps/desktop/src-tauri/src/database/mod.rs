pub mod schema;
pub mod migrations;

use std::path::Path;
use std::sync::{Arc, Mutex};
use rusqlite::{params, Connection, Result};
use chrono::Utc;
use uuid::Uuid;

use crate::models::db::{
    Project, NewProject, Task, NewTask, Execution, NewExecution,
    ExecutionEvent, AgentEntity, TeamWorkflow, NewTeamWorkflow,
    TeamWorkflowStep, NewTeamWorkflowStep
};

#[derive(Clone)]
pub struct DbManager {
    conn: Arc<Mutex<Connection>>,
}

impl DbManager {
    pub fn new(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(path)?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn new_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    // --- Projects ---
    pub fn create_project(&self, p: NewProject) -> Result<Project> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO projects (id, name, path, stack_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, p.name, p.path, p.stack_json, now, now],
        )?;

        Ok(Project {
            id,
            name: p.name,
            path: p.path,
            stack_json: p.stack_json,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn get_project_by_id(&self, id: &str) -> Result<Option<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, path, stack_json, created_at, updated_at FROM projects WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                stack_json: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_project_by_path(&self, path: &str) -> Result<Option<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, path, stack_json, created_at, updated_at FROM projects WHERE path = ?1")?;
        let mut rows = stmt.query(params![path])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                stack_json: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_projects(&self) -> Result<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, path, stack_json, created_at, updated_at FROM projects ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                stack_json: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        let mut projects = Vec::new();
        for p in rows {
            projects.push(p?);
        }
        Ok(projects)
    }

    pub fn update_project_stack(&self, id: &str, stack_json: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE projects SET stack_json = ?1, updated_at = ?2 WHERE id = ?3",
            params![stack_json, now, id],
        )?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    // --- Tasks ---
    pub fn create_task(&self, t: NewTask) -> Result<Task> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let status = "pending".to_string();

        conn.execute(
            "INSERT INTO tasks (id, project_id, title, description, status, agent_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, t.project_id, t.title, t.description, status, t.agent_id, now],
        )?;

        Ok(Task {
            id,
            project_id: t.project_id,
            title: t.title,
            description: t.description,
            status,
            agent_id: t.agent_id,
            created_at: now,
            started_at: None,
            completed_at: None,
        })
    }

    pub fn list_tasks(&self, project_id: &str) -> Result<Vec<Task>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, description, status, agent_id, created_at, started_at, completed_at FROM tasks WHERE project_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Task {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                agent_id: row.get(5)?,
                created_at: row.get(6)?,
                started_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })?;

        let mut tasks = Vec::new();
        for t in rows {
            tasks.push(t?);
        }
        Ok(tasks)
    }

    pub fn get_task_by_id(&self, id: &str) -> Result<Option<Task>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, description, status, agent_id, created_at, started_at, completed_at FROM tasks WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Task {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                agent_id: row.get(5)?,
                created_at: row.get(6)?,
                started_at: row.get(7)?,
                completed_at: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_task_status(&self, id: &str, status: &str, started_at: Option<&str>, completed_at: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tasks SET status = ?1, started_at = COALESCE(?2, started_at), completed_at = COALESCE(?3, completed_at) WHERE id = ?4",
            params![status, started_at, completed_at, id],
        )?;
        Ok(())
    }

    pub fn delete_task(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_all_tasks(&self, limit: usize) -> Result<Vec<Task>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, description, status, agent_id, created_at, started_at, completed_at FROM tasks ORDER BY created_at DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(Task {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                agent_id: row.get(5)?,
                created_at: row.get(6)?,
                started_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })?;

        let mut tasks = Vec::new();
        for t in rows {
            tasks.push(t?);
        }
        Ok(tasks)
    }

    // --- Executions ---
    pub fn create_execution(&self, e: NewExecution) -> Result<Execution> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let status = "running".to_string();

        conn.execute(
            "INSERT INTO executions (id, task_id, project_id, agent_id, command, status, started_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, e.task_id, e.project_id, e.agent_id, e.command, status, now],
        )?;

        Ok(Execution {
            id,
            task_id: e.task_id,
            project_id: e.project_id,
            agent_id: e.agent_id,
            command: e.command,
            status,
            exit_code: None,
            duration_ms: None,
            files_changed_json: None,
            git_diff: None,
            started_at: now,
            completed_at: None,
        })
    }

    pub fn update_execution_status(
        &self,
        id: &str,
        status: &str,
        exit_code: Option<i32>,
        duration_ms: Option<i64>,
        files_changed_json: Option<&str>,
        git_diff: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE executions SET status = ?1, exit_code = ?2, duration_ms = ?3, files_changed_json = ?4, git_diff = ?5, completed_at = ?6 WHERE id = ?7",
            params![status, exit_code, duration_ms, files_changed_json, git_diff, now, id],
        )?;
        Ok(())
    }

    /// Called at app start. No agent process survives an app restart, so any run still marked
    /// running is stale: mark it interrupted and put its task back to pending. Returns how many runs were fixed.
    pub fn recover_interrupted_runs(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        let runs = conn.execute(
            "UPDATE executions SET status = 'interrupted', completed_at = ?1 WHERE status = 'running'",
            params![now],
        )?;
        conn.execute("UPDATE tasks SET status = 'pending' WHERE status = 'running'", [])?;
        Ok(runs)
    }

    pub fn get_execution_by_id(&self, id: &str) -> Result<Option<Execution>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, task_id, project_id, agent_id, command, status, exit_code, duration_ms, files_changed_json, git_diff, started_at, completed_at FROM executions WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Execution {
                id: row.get(0)?,
                task_id: row.get(1)?,
                project_id: row.get(2)?,
                agent_id: row.get(3)?,
                command: row.get(4)?,
                status: row.get(5)?,
                exit_code: row.get(6)?,
                duration_ms: row.get(7)?,
                files_changed_json: row.get(8)?,
                git_diff: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_executions(&self, project_id: &str) -> Result<Vec<Execution>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, task_id, project_id, agent_id, command, status, exit_code, duration_ms, files_changed_json, git_diff, started_at, completed_at FROM executions WHERE project_id = ?1 ORDER BY started_at DESC"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(Execution {
                id: row.get(0)?,
                task_id: row.get(1)?,
                project_id: row.get(2)?,
                agent_id: row.get(3)?,
                command: row.get(4)?,
                status: row.get(5)?,
                exit_code: row.get(6)?,
                duration_ms: row.get(7)?,
                files_changed_json: row.get(8)?,
                git_diff: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        })?;

        let mut execs = Vec::new();
        for e in rows {
            execs.push(e?);
        }
        Ok(execs)
    }

    pub fn list_all_executions(&self, limit: usize) -> Result<Vec<Execution>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, task_id, project_id, agent_id, command, status, exit_code, duration_ms, files_changed_json, git_diff, started_at, completed_at FROM executions ORDER BY started_at DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(Execution {
                id: row.get(0)?,
                task_id: row.get(1)?,
                project_id: row.get(2)?,
                agent_id: row.get(3)?,
                command: row.get(4)?,
                status: row.get(5)?,
                exit_code: row.get(6)?,
                duration_ms: row.get(7)?,
                files_changed_json: row.get(8)?,
                git_diff: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        })?;

        let mut execs = Vec::new();
        for e in rows {
            execs.push(e?);
        }
        Ok(execs)
    }

    // --- Execution Events ---
    pub fn add_execution_event(&self, execution_id: &str, event_type: &str, payload: &str) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO execution_events (execution_id, event_type, payload, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![execution_id, event_type, payload, now],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list_execution_events(&self, execution_id: &str) -> Result<Vec<ExecutionEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, execution_id, event_type, payload, created_at FROM execution_events WHERE execution_id = ?1 ORDER BY id ASC"
        )?;
        let rows = stmt.query_map(params![execution_id], |row| {
            Ok(ExecutionEvent {
                id: row.get(0)?,
                execution_id: row.get(1)?,
                event_type: row.get(2)?,
                payload: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut events = Vec::new();
        for ev in rows {
            events.push(ev?);
        }
        Ok(events)
    }

    // --- Settings ---
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value_json FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;

        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value_json: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO settings (key, value_json, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
            params![key, value_json, now],
        )?;
        Ok(())
    }

    // --- Agents ---
    pub fn list_agents(&self) -> Result<Vec<AgentEntity>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, enabled, custom_path, settings_json FROM agents")?;
        let rows = stmt.query_map([], |row| {
            let enabled_int: i32 = row.get(2)?;
            Ok(AgentEntity {
                id: row.get(0)?,
                name: row.get(1)?,
                enabled: enabled_int != 0,
                custom_path: row.get(3)?,
                settings_json: row.get(4)?,
            })
        })?;

        let mut agents = Vec::new();
        for a in rows {
            agents.push(a?);
        }
        Ok(agents)
    }

    pub fn upsert_agent(&self, a: &AgentEntity) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let enabled_int = if a.enabled { 1 } else { 0 };
        conn.execute(
            "INSERT INTO agents (id, name, enabled, custom_path, settings_json) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET name = excluded.name, enabled = excluded.enabled, custom_path = excluded.custom_path, settings_json = excluded.settings_json",
            params![a.id, a.name, enabled_int, a.custom_path, a.settings_json],
        )?;
        Ok(())
    }

    // --- Team Workflows ---
    pub fn create_team_workflow(&self, w: NewTeamWorkflow) -> Result<TeamWorkflow> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let phase = "planning".to_string();
        let is_greenfield_int = if w.is_greenfield { 1 } else { 0 };

        conn.execute(
            "INSERT INTO team_workflows (id, project_id, title, goal, is_greenfield, phase, plan_manager_agent_id, plan_manager_fallback, developer_agent_id, developer_fallback, tester_agent_id, tester_fallback, current_step_index, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, ?13, ?14)",
            params![id, w.project_id, w.title, w.goal, is_greenfield_int, phase, w.plan_manager_agent_id, w.plan_manager_fallback, w.developer_agent_id, w.developer_fallback, w.tester_agent_id, w.tester_fallback, now, now],
        )?;

        Ok(TeamWorkflow {
            id,
            project_id: w.project_id,
            title: w.title,
            goal: w.goal,
            is_greenfield: w.is_greenfield,
            phase,
            plan_manager_agent_id: w.plan_manager_agent_id,
            plan_manager_fallback: w.plan_manager_fallback,
            developer_agent_id: w.developer_agent_id,
            developer_fallback: w.developer_fallback,
            tester_agent_id: w.tester_agent_id,
            tester_fallback: w.tester_fallback,
            branch_name: None,
            pr_url: None,
            pr_method: None,
            current_step_index: 0,
            created_at: now.clone(),
            updated_at: now,
            completed_at: None,
        })
    }

    pub fn get_team_workflow_by_id(&self, id: &str) -> Result<Option<TeamWorkflow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, goal, is_greenfield, phase, plan_manager_agent_id, plan_manager_fallback, developer_agent_id, developer_fallback, tester_agent_id, tester_fallback, branch_name, pr_url, pr_method, current_step_index, created_at, updated_at, completed_at FROM team_workflows WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![id])?;

        if let Some(row) = rows.next()? {
            let is_greenfield_int: i32 = row.get(4)?;
            Ok(Some(TeamWorkflow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                goal: row.get(3)?,
                is_greenfield: is_greenfield_int != 0,
                phase: row.get(5)?,
                plan_manager_agent_id: row.get(6)?,
                plan_manager_fallback: row.get(7)?,
                developer_agent_id: row.get(8)?,
                developer_fallback: row.get(9)?,
                tester_agent_id: row.get(10)?,
                tester_fallback: row.get(11)?,
                branch_name: row.get(12)?,
                pr_url: row.get(13)?,
                pr_method: row.get(14)?,
                current_step_index: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
                completed_at: row.get(18)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_team_workflows(&self, project_id: &str) -> Result<Vec<TeamWorkflow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, goal, is_greenfield, phase, plan_manager_agent_id, plan_manager_fallback, developer_agent_id, developer_fallback, tester_agent_id, tester_fallback, branch_name, pr_url, pr_method, current_step_index, created_at, updated_at, completed_at FROM team_workflows WHERE project_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            let is_greenfield_int: i32 = row.get(4)?;
            Ok(TeamWorkflow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                goal: row.get(3)?,
                is_greenfield: is_greenfield_int != 0,
                phase: row.get(5)?,
                plan_manager_agent_id: row.get(6)?,
                plan_manager_fallback: row.get(7)?,
                developer_agent_id: row.get(8)?,
                developer_fallback: row.get(9)?,
                tester_agent_id: row.get(10)?,
                tester_fallback: row.get(11)?,
                branch_name: row.get(12)?,
                pr_url: row.get(13)?,
                pr_method: row.get(14)?,
                current_step_index: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
                completed_at: row.get(18)?,
            })
        })?;

        let mut list = Vec::new();
        for item in rows {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn list_all_team_workflows(&self) -> Result<Vec<TeamWorkflow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, goal, is_greenfield, phase, plan_manager_agent_id, plan_manager_fallback, developer_agent_id, developer_fallback, tester_agent_id, tester_fallback, branch_name, pr_url, pr_method, current_step_index, created_at, updated_at, completed_at FROM team_workflows ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            let is_greenfield_int: i32 = row.get(4)?;
            Ok(TeamWorkflow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                goal: row.get(3)?,
                is_greenfield: is_greenfield_int != 0,
                phase: row.get(5)?,
                plan_manager_agent_id: row.get(6)?,
                plan_manager_fallback: row.get(7)?,
                developer_agent_id: row.get(8)?,
                developer_fallback: row.get(9)?,
                tester_agent_id: row.get(10)?,
                tester_fallback: row.get(11)?,
                branch_name: row.get(12)?,
                pr_url: row.get(13)?,
                pr_method: row.get(14)?,
                current_step_index: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
                completed_at: row.get(18)?,
            })
        })?;

        let mut list = Vec::new();
        for item in rows {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn update_team_workflow_phase(&self, id: &str, phase: &str, current_step_index: i32, branch_name: Option<&str>, pr_url: Option<&str>, pr_method: Option<&str>, completed_at: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE team_workflows SET phase = ?1, current_step_index = ?2, branch_name = COALESCE(?3, branch_name), pr_url = COALESCE(?4, pr_url), pr_method = COALESCE(?5, pr_method), completed_at = COALESCE(?6, completed_at), updated_at = ?7 WHERE id = ?8",
            params![phase, current_step_index, branch_name, pr_url, pr_method, completed_at, now, id],
        )?;
        Ok(())
    }

    // --- Team Workflow Steps ---
    pub fn create_team_workflow_step(&self, s: NewTeamWorkflowStep) -> Result<TeamWorkflowStep> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let status = "pending".to_string();

        conn.execute(
            "INSERT INTO team_workflow_steps (id, workflow_id, step_number, title, description, assigned_role, assigned_agent_id, fallback_agent_used, status, retry_count, test_command) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10)",
            params![id, s.workflow_id, s.step_number, s.title, s.description, s.assigned_role, s.assigned_agent_id, s.fallback_agent_used, status, s.test_command],
        )?;

        Ok(TeamWorkflowStep {
            id,
            workflow_id: s.workflow_id,
            step_number: s.step_number,
            title: s.title,
            description: s.description,
            assigned_role: s.assigned_role,
            assigned_agent_id: s.assigned_agent_id,
            fallback_agent_used: s.fallback_agent_used,
            status,
            retry_count: 0,
            test_command: s.test_command,
            verification_report: None,
            error_log: None,
            started_at: None,
            completed_at: None,
        })
    }

    pub fn list_team_workflow_steps(&self, workflow_id: &str) -> Result<Vec<TeamWorkflowStep>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, step_number, title, description, assigned_role, assigned_agent_id, fallback_agent_used, status, retry_count, test_command, verification_report, error_log, started_at, completed_at FROM team_workflow_steps WHERE workflow_id = ?1 ORDER BY step_number ASC"
        )?;
        let rows = stmt.query_map(params![workflow_id], |row| {
            Ok(TeamWorkflowStep {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                step_number: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                assigned_role: row.get(5)?,
                assigned_agent_id: row.get(6)?,
                fallback_agent_used: row.get(7)?,
                status: row.get(8)?,
                retry_count: row.get(9)?,
                test_command: row.get(10)?,
                verification_report: row.get(11)?,
                error_log: row.get(12)?,
                started_at: row.get(13)?,
                completed_at: row.get(14)?,
            })
        })?;

        let mut steps = Vec::new();
        for s in rows {
            steps.push(s?);
        }
        Ok(steps)
    }

    pub fn update_team_workflow_step(
        &self,
        id: &str,
        status: &str,
        retry_count: i32,
        verification_report: Option<&str>,
        error_log: Option<&str>,
        started_at: Option<&str>,
        completed_at: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE team_workflow_steps SET status = ?1, retry_count = ?2, verification_report = ?3, error_log = ?4, started_at = COALESCE(?5, started_at), completed_at = COALESCE(?6, completed_at) WHERE id = ?7",
            params![status, retry_count, verification_report, error_log, started_at, completed_at, id],
        )?;
        Ok(())
    }

    pub fn update_team_workflow_step_fallback(
        &self,
        id: &str,
        new_agent_id: &str,
        fallback_agent_used: &str,
        status: &str,
        error_log: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE team_workflow_steps SET assigned_agent_id = ?1, fallback_agent_used = ?2, status = ?3, error_log = ?4 WHERE id = ?5",
            params![new_agent_id, fallback_agent_used, status, error_log, id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::db::{NewProject, NewTeamWorkflow, NewTeamWorkflowStep};

    #[test]
    fn test_database_team_workflows_and_crud() {
        let db = DbManager::new_in_memory().expect("failed to init db");

        let project = db.create_project(NewProject {
            name: "TestProject".to_string(),
            path: "C:\\Test\\Project".to_string(),
            stack_json: "{}".to_string(),
        }).expect("failed to create project");

        let workflow = db.create_team_workflow(NewTeamWorkflow {
            project_id: project.id.clone(),
            title: "Build Authentication".to_string(),
            goal: "Add user login and signup".to_string(),
            is_greenfield: false,
            plan_manager_agent_id: "claude".to_string(),
            plan_manager_fallback: Some("antigravity".to_string()),
            developer_agent_id: "codex".to_string(),
            developer_fallback: Some("claude".to_string()),
            tester_agent_id: "antigravity".to_string(),
            tester_fallback: Some("codex".to_string()),
        }).expect("failed to create team workflow");

        assert_eq!(workflow.title, "Build Authentication");
        assert_eq!(workflow.phase, "planning");
        assert_eq!(workflow.developer_fallback, Some("claude".to_string()));

        let step1 = db.create_team_workflow_step(NewTeamWorkflowStep {
            workflow_id: workflow.id.clone(),
            step_number: 1,
            title: "Scaffold Auth Controller".to_string(),
            description: "Create endpoint".to_string(),
            assigned_role: "developer".to_string(),
            assigned_agent_id: "codex".to_string(),
            fallback_agent_used: None,
            test_command: Some("pnpm test".to_string()),
        }).expect("failed to create step");

        assert_eq!(step1.step_number, 1);
        assert_eq!(step1.status, "pending");

        // Test fallback update
        db.update_team_workflow_step_fallback(
            &step1.id,
            "claude",
            "claude",
            "pending",
            Some("Tokens exhausted on codex. Switched to claude."),
        ).expect("failed to update fallback");

        let steps_after_fb = db.list_team_workflow_steps(&workflow.id).expect("failed to list steps");
        assert_eq!(steps_after_fb[0].assigned_agent_id, "claude");
        assert_eq!(steps_after_fb[0].fallback_agent_used, Some("claude".to_string()));

        db.update_team_workflow_step(
            &step1.id,
            "completed",
            0,
            Some("All 4 unit tests passed"),
            None,
            None,
            None,
        ).expect("failed to update step");

        let updated_steps = db.list_team_workflow_steps(&workflow.id).expect("failed to list updated steps");
        assert_eq!(updated_steps[0].status, "completed");
        assert_eq!(updated_steps[0].verification_report, Some("All 4 unit tests passed".to_string()));
    }
}


