use rusqlite::{Connection, Result};
use super::schema::INITIAL_SCHEMA;

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch(INITIAL_SCHEMA)?;
    Ok(())
}
