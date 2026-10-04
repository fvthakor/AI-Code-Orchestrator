pub mod schema;
pub mod migrations;

use std::path::Path;
use std::sync::{Arc, Mutex};
use rusqlite::{params, Connection, Result};
use chrono::Utc;
use uuid::Uuid;

use crate::models::db::{
    Project, NewProject, Task, NewTask, Execution, NewExecution,
    ExecutionEvent, AgentEntity
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
}
