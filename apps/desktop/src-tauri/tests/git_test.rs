use std::fs;
use std::process::Command;
use tempfile::tempdir;
use ai_code_orchestrator_lib::git::cli::GitService;

#[test]
fn test_git_service_status_diff_and_log() {
    let dir = tempdir().expect("failed to create temp dir");
    let path = dir.path();

    // 1. Initialize git repo
    let run_git = |args: &[&str]| {
        let status = Command::new("git")
            .current_dir(path)
            .args(args)
            .status()
            .expect("failed to run git command");
        assert!(status.success());
    };

    run_git(&["init"]);
    run_git(&["config", "user.name", "Test User"]);
    run_git(&["config", "user.email", "test@example.com"]);

    // Initial commit
    fs::write(path.join("file1.txt"), "Hello world\n").unwrap();
    run_git(&["add", "file1.txt"]);
    run_git(&["commit", "-m", "Initial commit"]);

    // 2. Query initial context
    let context = GitService::get_context(path).expect("failed to get git context");
    assert!(context.is_clean);
    assert!(!context.branch.is_empty());

    // 3. Make changes
    fs::write(path.join("file1.txt"), "Hello world\nAdded line\n").unwrap();
    fs::write(path.join("file2.txt"), "Untracked file\n").unwrap();

    let context2 = GitService::get_context(path).expect("failed to get git context after edit");
    assert!(!context2.is_clean);
    assert!(context2.modified_files.iter().any(|f| f.contains("file1.txt")));
    assert!(context2.untracked_files.iter().any(|f| f.contains("file2.txt")));

    // 4. Query Diff
    let diff = GitService::get_diff(path, None).expect("failed to get diff");
    assert!(diff.contains("+Added line"));

    // 5. Query Log
    let logs = GitService::get_log(path, 5).expect("failed to get log");
    assert_eq!(logs.len(), 1);
    assert_eq!(logs[0].message, "Initial commit");
}
