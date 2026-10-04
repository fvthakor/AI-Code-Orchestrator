use ai_code_orchestrator_lib::agents::registry::AgentRegistry;
use ai_code_orchestrator_lib::agents::resolver::WindowsExecutableResolver;

#[tokio::test]
async fn test_windows_executable_resolver() {
    // 1. Should resolve powershell or cmd
    let ps = WindowsExecutableResolver::resolve_binary("powershell");
    assert!(ps.is_some(), "powershell should resolve on Windows");

    // 2. Should resolve cmd
    let cmd = WindowsExecutableResolver::resolve_binary("cmd");
    assert!(cmd.is_some(), "cmd should resolve on Windows");
}

#[tokio::test]
async fn test_agent_registry_detection() {
    let registry = AgentRegistry::default();
    let agents = registry.list_adapters();
    assert_eq!(agents.len(), 3);
    assert!(agents.iter().any(|a| a.id() == "claude"));
    assert!(agents.iter().any(|a| a.id() == "codex"));
    assert!(agents.iter().any(|a| a.id() == "opencode"));

    // Detect all
    let results = registry.detect_all(None).await;
    assert_eq!(results.len(), 3);

    // Verify Claude detection
    let claude = results.iter().find(|r| r.id == "claude").expect("claude result missing");
    if claude.status == "connected" {
        assert!(claude.version.is_some());
        assert!(claude.executable_path.is_some());
    }
}
