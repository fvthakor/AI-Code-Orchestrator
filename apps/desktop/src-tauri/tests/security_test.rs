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
    let eval_format = engine.evaluate("format C: /fs:NTFS", "C:\\Projects\\Dialynx");
    assert_eq!(eval_format.decision, PolicyDecision::Blocked);
    assert_eq!(eval_format.risk_level, PolicyRiskLevel::Blocked);

    let eval_diskpart = engine.evaluate("diskpart /s script.txt", "C:\\Projects\\Dialynx");
    assert_eq!(eval_diskpart.decision, PolicyDecision::Blocked);

    let eval_reg = engine.evaluate("reg delete HKLM\\Software\\test", "C:\\Projects\\Dialynx");
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
