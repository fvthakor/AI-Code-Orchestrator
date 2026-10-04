use serde::{Deserialize, Serialize};
use super::sanitizer::CommandSanitizer;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PolicyDecision {
    Allowed,
    RequiresApproval,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PolicyRiskLevel {
    Safe,
    Low,
    Medium,
    High,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyEvaluation {
    pub command: String,
    pub decision: PolicyDecision,
    pub risk_level: PolicyRiskLevel,
    pub reason: String,
    pub matched_rule: Option<String>,
}

#[derive(Clone)]
pub struct PolicyEngine {
    pub allowed_tools: Vec<&'static str>,
    pub blocked_keywords: Vec<&'static str>,
    pub approval_keywords: Vec<&'static str>,
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self {
            allowed_tools: vec![
                "git", "npm", "pnpm", "yarn", "node", "npx", "cargo", "rustc",
                "go", "composer", "php", "python", "py", "pip", "docker",
                "claude", "codex", "opencode", "echo", "dir", "ls", "pwd", "cls", "clear",
                "write-output", "get-childitem", "test"
            ],
            blocked_keywords: vec![
                "format ", "format.com", "diskpart", "shutdown", "takeown", "vssadmin",
                "bcdedit", "wbadmin", "reg delete", "reg add", "reg import",
                "rundll32", "-encodedcommand", "-enc "
            ],
            approval_keywords: vec![
                "reset --hard", "clean -f", "rmdir /s", "rm -rf", "remove-item -recurse",
                "drop table", "drop database", "truncate", "taskkill /f /im explorer"
            ],
        }
    }
}

impl PolicyEngine {
    pub fn evaluate(&self, command: &str, _working_dir: &str) -> PolicyEvaluation {
        let trimmed = command.trim();
        let lower = trimmed.to_lowercase();

        // 1. Sensitive file targets
        if CommandSanitizer::contains_sensitive_target(trimmed) {
            return PolicyEvaluation {
                command: trimmed.to_string(),
                decision: PolicyDecision::Blocked,
                risk_level: PolicyRiskLevel::Blocked,
                reason: "Command attempts to access sensitive file (.env, .ssh, or system target)".to_string(),
                matched_rule: Some("sensitive_target_protection".to_string()),
            };
        }

        // 2. Unconditionally blocked keywords
        for blocked in &self.blocked_keywords {
            if lower.contains(blocked) {
                return PolicyEvaluation {
                    command: trimmed.to_string(),
                    decision: PolicyDecision::Blocked,
                    risk_level: PolicyRiskLevel::Blocked,
                    reason: format!("Command contains destructive or restricted keyword '{}'", blocked),
                    matched_rule: Some(format!("blocked:{}", blocked)),
                };
            }
        }

        // 3. Approval keywords
        for req in &self.approval_keywords {
            if lower.contains(req) {
                return PolicyEvaluation {
                    command: trimmed.to_string(),
                    decision: PolicyDecision::RequiresApproval,
                    risk_level: PolicyRiskLevel::High,
                    reason: format!("Command contains potentially destructive operation '{}'", req),
                    matched_rule: Some(format!("requires_approval:{}", req)),
                };
            }
        }

        // 4. Check program name against allowed tools
        let first_token = lower
            .split_whitespace()
            .next()
            .unwrap_or("")
            .trim_end_matches(".exe")
            .trim_end_matches(".cmd")
            .trim_end_matches(".bat");

        if self.allowed_tools.iter().any(|&tool| tool == first_token) {
            return PolicyEvaluation {
                command: trimmed.to_string(),
                decision: PolicyDecision::Allowed,
                risk_level: PolicyRiskLevel::Safe,
                reason: format!("Tool '{}' is in verified developer whitelist", first_token),
                matched_rule: Some(format!("whitelist:{}", first_token)),
            };
        }

        // 5. Unknown tool - require approval
        PolicyEvaluation {
            command: trimmed.to_string(),
            decision: PolicyDecision::RequiresApproval,
            risk_level: PolicyRiskLevel::Medium,
            reason: format!("Unrecognized command '{}' requires developer approval", first_token),
            matched_rule: Some("unknown_command".to_string()),
        }
    }
}
