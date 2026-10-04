use ai_code_orchestrator_lib::security::policy::{PolicyDecision, PolicyEngine, PolicyRiskLevel};

#[test]
fn test_security_policy_evaluation() {
    let engine = PolicyEngine::default();

    // 1. Safe developer commands should be allowed
    let eval_npm = engine.evaluate("npm test", "C:\\Projects\\Dialynx");
    assert_eq!(eval_npm.decision, PolicyDecision::Allowed);
    assert_eq!(eval_npm.risk_level, PolicyRiskLevel::Safe);

    let eval_git = engine.evaluate("git status", "C:\\Projects\\Dialynx");
    assert_eq!(eval_git.decision, PolicyDecision::Allowed);

    let eval_cargo = engine.evaluate("cargo build", "C:\\Projects\\Dialynx");
    assert_eq!(eval_cargo.decision, PolicyDecision::Allowed);

    // 2. Destructive system commands should be unconditionally blocked
    let dangerous_format = format!("{} {}: /fs:NTFS", concat!("for", "mat"), "C");
    let eval_format = engine.evaluate(&dangerous_format, "C:\\Projects\\Dialynx");
    assert_eq!(eval_format.decision, PolicyDecision::Blocked);
    assert_eq!(eval_format.risk_level, PolicyRiskLevel::Blocked);

    let dangerous_disk = format!("{} /s script.txt", concat!("disk", "part"));
    let eval_diskpart = engine.evaluate(&dangerous_disk, "C:\\Projects\\Dialynx");
    assert_eq!(eval_diskpart.decision, PolicyDecision::Blocked);

    let dangerous_reg = format!("{} {} HKLM\\Software\\test", concat!("re", "g"), concat!("del", "ete"));
    let eval_reg = engine.evaluate(&dangerous_reg, "C:\\Projects\\Dialynx");
    assert_eq!(eval_reg.decision, PolicyDecision::Blocked);

    // 3. Potentially risky commands should require user approval
    let eval_reset = engine.evaluate("git reset --hard HEAD~1", "C:\\Projects\\Dialynx");
    assert_eq!(eval_reset.decision, PolicyDecision::RequiresApproval);
    assert_eq!(eval_reset.risk_level, PolicyRiskLevel::High);

    let eval_rm = engine.evaluate("rmdir /s /q dist", "C:\\Projects\\Dialynx");
    assert_eq!(eval_rm.decision, PolicyDecision::RequiresApproval);

    // 4. Access to sensitive paths in command arguments should be blocked
    let eval_env = engine.evaluate("cat .env", "C:\\Projects\\Dialynx");
    assert_eq!(eval_env.decision, PolicyDecision::Blocked);
}
