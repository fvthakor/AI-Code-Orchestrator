use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use uuid::Uuid;

use super::job_object::WinJobObject;
use super::pty_session::PtySession;

#[derive(Clone)]
pub struct ProcessManager {
    sessions: Arc<Mutex<HashMap<String, Arc<PtySession>>>>,
    job_object: Arc<Option<WinJobObject>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            job_object: Arc::new(WinJobObject::new()),
        }
    }

    pub fn spawn_command<F>(
        &self,
        working_dir: &Path,
        program: &str,
        args: &[&str],
        cols: u16,
        rows: u16,
        on_output: F,
    ) -> Result<String, String>
    where
        F: Fn(String) + Send + 'static,
    {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new(program);
        for arg in args {
            cmd.arg(*arg);
        }
        cmd.cwd(working_dir);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command '{}': {}", program, e))?;

        let pid = child.process_id();
        if let (Some(pid), Some(job)) = (pid, self.job_object.as_ref()) {
            job.assign_process(pid);
        }

        let session_id = Uuid::new_v4().to_string();
        let running = Arc::new(AtomicBool::new(true));

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

        let session = Arc::new(PtySession {
            session_id: session_id.clone(),
            pid,
            master: Arc::new(Mutex::new(pair.master)),
            writer: Arc::new(Mutex::new(writer)),
            running: running.clone(),
        });

        {
            let mut map = self.sessions.lock().unwrap();
            map.insert(session_id.clone(), session.clone());
        }

        // Spawn background reader thread
        let session_id_clone = session_id.clone();
        let sessions_map = self.sessions.clone();

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while running.load(Ordering::SeqCst) {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        on_output(text);
                    }
                    Err(_) => break,
                }
            }

            running.store(false, Ordering::SeqCst);
            let mut map = sessions_map.lock().unwrap();
            map.remove(&session_id_clone);
        });

        Ok(session_id)
    }

    pub fn write_input(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let session = {
            let map = self.sessions.lock().unwrap();
            map.get(session_id).cloned()
        };

        if let Some(session) = session {
            session.write_input(data)
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let session = {
            let map = self.sessions.lock().unwrap();
            map.get(session_id).cloned()
        };

        if let Some(session) = session {
            session.resize(cols, rows)
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    pub fn kill_session(&self, session_id: &str) -> Result<(), String> {
        let session = {
            let mut map = self.sessions.lock().unwrap();
            map.remove(session_id)
        };

        if let Some(session) = session {
            session.kill();
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    pub fn is_session_running(&self, session_id: &str) -> bool {
        let map = self.sessions.lock().unwrap();
        map.get(session_id).map(|s| s.is_running()).unwrap_or(false)
    }

    pub fn active_sessions(&self) -> Vec<String> {
        let map = self.sessions.lock().unwrap();
        map.keys().cloned().collect()
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}
