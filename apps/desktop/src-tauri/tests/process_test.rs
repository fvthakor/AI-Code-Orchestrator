use std::sync::mpsc;
use std::time::Duration;
use tempfile::tempdir;
use ai_code_orchestrator_lib::execution::process_manager::ProcessManager;

#[test]
fn test_conpty_process_execution_and_io() {
    let dir = tempdir().expect("failed to create tempdir");
    let pm = ProcessManager::new();

    let (tx, rx) = mpsc::channel::<String>();
    
    // Spawn a PowerShell session that executes Write-Output and exits
    let session_id = pm.spawn_command(
        dir.path(),
        "powershell.exe",
        &["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Write-Output 'PtyOnline'"],
        80,
        24,
        Box::new(move |output| {
            let _ = tx.send(output);
        }),
    ).expect("failed to spawn PTY session");

    // Collect output chunks
    let mut accumulated = String::new();
    let timeout = std::time::Instant::now();
    while timeout.elapsed() < Duration::from_secs(10) {
        if let Ok(chunk) = rx.recv_timeout(Duration::from_millis(500)) {
            accumulated.push_str(&chunk);
            if accumulated.contains("PtyOnline") {
                break;
            }
        }
    }

    assert!(accumulated.contains("PtyOnline"), "Output was: {}", accumulated);

    // Verify session termination / cleanup
    let _ = pm.kill_session(&session_id);
    assert!(!pm.is_session_running(&session_id));
}
