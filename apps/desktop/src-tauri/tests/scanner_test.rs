use std::fs;
use tempfile::tempdir;
use ai_code_orchestrator_lib::filesystem::path_guard::PathGuard;
use ai_code_orchestrator_lib::filesystem::scanner::ProjectScanner;

#[test]
fn test_path_guard_validations() {
    let dir = tempdir().expect("failed to create temp dir");
    let valid_path = dir.path();

    // 1. Valid directory should pass
    let validated = PathGuard::validate_project_path(valid_path.to_str().unwrap());
    assert!(validated.is_ok());

    // 2. Sensitive paths should be rejected
    assert!(PathGuard::is_sensitive_path("C:\\Windows\\System32"));
    assert!(PathGuard::is_sensitive_path("C:\\Users\\User\\.ssh\\id_rsa"));
    assert!(PathGuard::is_sensitive_path("C:\\Projects\\App\\.env"));
    assert!(PathGuard::is_sensitive_path("C:\\Projects\\App\\.env.production"));

    // 3. Traversal outside project should be rejected
    assert!(PathGuard::ensure_inside_project(valid_path, valid_path.join("src/index.ts")).is_ok());
    assert!(PathGuard::ensure_inside_project(valid_path, valid_path.join("../../secret.txt")).is_err());
}

#[test]
fn test_project_scanner_stack_detection() {
    let dir = tempdir().expect("failed to create temp dir");
    let path = dir.path();

    // Create a mock package.json
    let package_json = r#"{
      "name": "mock-app",
      "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "next": "14.0.0"
      },
      "devDependencies": {
        "typescript": "^5.0.0",
        "tailwindcss": "^3.0.0"
      }
    }"#;
    fs::write(path.join("package.json"), package_json).unwrap();
    fs::write(path.join("pnpm-lock.yaml"), "lockfileVersion: '9.0'").unwrap();
    fs::write(path.join("Dockerfile"), "FROM node:20").unwrap();

    let context = ProjectScanner::scan(path).expect("failed to scan project");
    assert!(context.stack.languages.contains(&"TypeScript".to_string()) || context.stack.languages.contains(&"JavaScript".to_string()));
    assert!(context.stack.frameworks.contains(&"React".to_string()));
    assert!(context.stack.frameworks.contains(&"Next.js".to_string()));
    assert!(context.stack.package_managers.contains(&"pnpm".to_string()));
    assert!(context.stack.infrastructure.contains(&"Docker".to_string()));
}
