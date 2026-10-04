use rusqlite::{Connection, Result};
use super::schema::INITIAL_SCHEMA;

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch(INITIAL_SCHEMA)?;

    // Backward-compatible column additions for team token fallback
    let _ = conn.execute("ALTER TABLE team_workflows ADD COLUMN plan_manager_fallback TEXT;", []);
    let _ = conn.execute("ALTER TABLE team_workflows ADD COLUMN developer_fallback TEXT;", []);
    let _ = conn.execute("ALTER TABLE team_workflows ADD COLUMN tester_fallback TEXT;", []);
    let _ = conn.execute("ALTER TABLE team_workflow_steps ADD COLUMN fallback_agent_used TEXT;", []);

    Ok(())
}
