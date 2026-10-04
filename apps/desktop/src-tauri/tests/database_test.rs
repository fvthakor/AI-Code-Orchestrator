use ai_code_orchestrator_lib::database::DbManager;
use ai_code_orchestrator_lib::models::db::{NewProject, NewTask, NewExecution};

#[test]
fn test_database_initialization_and_crud() {
    let db = DbManager::new_in_memory().expect("failed to initialize in-memory database");
    
    // 1. Projects
    let new_project = NewProject {
        name: "Dialynx".to_string(),
        path: "C:\\Projects\\Dialynx".to_string(),
        stack_json: r#"{"languages":["TypeScript","PHP"],"frameworks":["React","Laravel"],"packageManagers":["pnpm","composer"],"databases":["MySQL"],"infrastructure":[]}"#.to_string(),
    };
    let project = db.create_project(new_project).expect("failed to create project");
    assert_eq!(project.name, "Dialynx");
    assert_eq!(project.path, "C:\\Projects\\Dialynx");

    let found_project = db.get_project_by_id(&project.id).expect("failed to get project");
    assert!(found_project.is_some());
    assert_eq!(found_project.unwrap().id, project.id);

    // 2. Tasks
    let new_task = NewTask {
        project_id: project.id.clone(),
        title: "Implement Auth API".to_string(),
        description: "Add JWT authentication endpoint".to_string(),
        agent_id: Some("claude".to_string()),
    };
    let task = db.create_task(new_task).expect("failed to create task");
    assert_eq!(task.title, "Implement Auth API");
    assert_eq!(task.status, "pending");

    let tasks = db.list_tasks(&project.id).expect("failed to list tasks");
    assert_eq!(tasks.len(), 1);

    // 3. Executions
    let new_exec = NewExecution {
        task_id: Some(task.id.clone()),
        project_id: project.id.clone(),
        agent_id: Some("claude".to_string()),
        command: "claude -p 'implement auth'".to_string(),
    };
    let execution = db.create_execution(new_exec).expect("failed to create execution");
    assert_eq!(execution.status, "running");

    // Update execution status
    db.update_execution_status(
        &execution.id,
        "completed",
        Some(0),
        Some(45000),
        Some(r#"[{"path":"src/auth.ts","status":"modified"}]"#),
        Some("diff --git a/src/auth.ts b/src/auth.ts\n+export function login() {}"),
    ).expect("failed to update execution");

    let updated_exec = db.get_execution_by_id(&execution.id).expect("failed to get execution");
    assert!(updated_exec.is_some());
    let u = updated_exec.unwrap();
    assert_eq!(u.status, "completed");
    assert_eq!(u.exit_code, Some(0));
    assert_eq!(u.duration_ms, Some(45000));
}
