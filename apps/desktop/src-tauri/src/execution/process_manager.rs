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
use crate::models::db::ActiveAgentTaskInfo;

#[derive(Clone)]
pub struct ProcessManager {
    sessions: Arc<Mutex<HashMap<String, Arc<PtySession>>>>,
    active_agent_task: Arc<Mutex<Option<ActiveAgentTaskInfo>>>,
    /// Exit code of each finished session, kept after the session is removed
    exit_codes: Arc<Mutex<HashMap<String, u32>>>,
    /// Which PTY session runs each agent execution
    execution_sessions: Arc<Mutex<HashMap<String, String>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            active_agent_task: Arc::new(Mutex::new(None)),
            exit_codes: Arc::new(Mutex::new(HashMap::new())),
            execution_sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Records which session runs an agent execution, so the execution can be stopped or checked later.
    pub fn link_execution(&self, execution_id: &str, session_id: &str) {
        self.execution_sessions
            .lock()
            .unwrap()
            .insert(execution_id.to_string(), session_id.to_string());
    }

    pub fn session_for_execution(&self, execution_id: &str) -> Option<String> {
        self.execution_sessions.lock().unwrap().get(execution_id).cloned()
    }

    /// True only while the execution's process is actually alive (not just while a lock says so).
    pub fn execution_running(&self, execution_id: &str) -> bool {
        self.session_for_execution(execution_id)
            .map_or(false, |session_id| self.is_session_running(&session_id))
    }

    pub fn session_exit_code(&self, session_id: &str) -> Option<u32> {
        self.exit_codes.lock().unwrap().get(session_id).copied()
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

        let is_cmd_or_bat = program.to_lowercase().ends_with(".cmd") || program.to_lowercase().ends_with(".bat");
        let mut cmd = if is_cmd_or_bat {
            let mut c = CommandBuilder::new("cmd.exe");
            c.arg("/c");
            c.arg(program);
            for arg in args {
                c.arg(*arg);
            }
            c
        } else {
            let mut c = CommandBuilder::new(program);
            for arg in args {
                c.arg(*arg);
            }
            c
        };
        let clean_wd_str = working_dir.to_string_lossy();
        let clean_wd = if let Some(stripped) = clean_wd_str.strip_prefix(r"\\?\") {
            Path::new(stripped)
        } else {
            working_dir
        };
        cmd.cwd(clean_wd);

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command '{}': {}", program, e))?;

        let pid = child.process_id();
        // One job per session: when the session ends, everything it left running (e.g. a dev server
        // the agent started for testing) is killed, so it cannot hold a port for the next run
        let session_job = WinJobObject::new();
        if let (Some(pid), Some(job)) = (pid, session_job.as_ref()) {
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
        let running_reader = running.clone();

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while running_reader.load(Ordering::SeqCst) {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        on_output(text);
                    }
                    Err(_) => break,
                }
            }

            running_reader.store(false, Ordering::SeqCst);
            let mut map = sessions_map.lock().unwrap();
            map.remove(&session_id_clone);
        });

        // Spawn process exit watcher thread to ensure session termination when child exits
        let running_watcher = running.clone();
        let sessions_watcher = self.sessions.clone();
        let exit_codes_watcher = self.exit_codes.clone();
        let session_id_watcher = session_id.clone();

        thread::spawn(move || {
            if let Ok(status) = child.wait() {
                exit_codes_watcher
                    .lock()
                    .unwrap()
                    .insert(session_id_watcher.clone(), status.exit_code());
            }
            std::thread::sleep(std::time::Duration::from_millis(300));
            running_watcher.store(false, Ordering::SeqCst);
            {
                let mut map = sessions_watcher.lock().unwrap();
                map.remove(&session_id_watcher);
            }
            // Session is over: closing its job kills any process it left behind
            drop(session_job);
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

    pub fn get_active_agent_task(&self) -> Option<ActiveAgentTaskInfo> {
        self.active_agent_task.lock().unwrap().clone()
    }

    pub fn set_active_agent_task(&self, task: Option<ActiveAgentTaskInfo>) {
        let mut lock = self.active_agent_task.lock().unwrap();
        *lock = task;
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}
