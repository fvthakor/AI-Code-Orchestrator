use chrono::Utc;
use crate::database::DbManager;
use crate::models::db::{NewTeamWorkflow, TeamWorkflow, TeamWorkflowStep};

pub struct TeamCoordinator;

impl TeamCoordinator {
    pub fn is_token_exhausted(error_text: &str) -> bool {
        let lower = error_text.to_lowercase();
        lower.contains("429")
            || lower.contains("rate limit")
            || lower.contains("rate_limit")
            || lower.contains("quota exceeded")
            || lower.contains("exceeded your current quota")
            || lower.contains("insufficient_quota")
            || lower.contains("resource_exhausted")
            || lower.contains("credit balance")
            || lower.contains("usage limit")
    }

    pub fn start_workflow(
        db: &DbManager,
        project_id: String,
        title: String,
        goal: String,
        is_greenfield: bool,
        plan_manager_agent_id: String,
        plan_manager_fallback: Option<String>,
        developer_agent_id: String,
        developer_fallback: Option<String>,
        tester_agent_id: String,
        tester_fallback: Option<String>,
    ) -> Result<TeamWorkflow, String> {
        let workflow = db
            .create_team_workflow(NewTeamWorkflow {
                project_id,
                title,
                goal,
                is_greenfield,
                plan_manager_agent_id,
                plan_manager_fallback,
                developer_agent_id,
                developer_fallback,
                tester_agent_id,
                tester_fallback,
            })
            .map_err(|e| format!("Failed to create team workflow: {}", e))?;

        Ok(workflow)
    }

    pub fn advance_step(
        db: &DbManager,
        workflow_id: &str,
        step_id: &str,
        status: &str,
        verification_report: Option<&str>,
        error_log: Option<&str>,
    ) -> Result<TeamWorkflow, String> {
        let mut workflow = db
            .get_team_workflow_by_id(workflow_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Workflow '{}' not found", workflow_id))?;

        let steps = db
            .list_team_workflow_steps(workflow_id)
            .map_err(|e| e.to_string())?;

        let now = Utc::now().to_rfc3339();

        if let Some(step) = steps.iter().find(|s| s.id == step_id) {
            // Check for automatic token exhaustion / rate limit fallback
            if status == "failed" && error_log.map_or(false, Self::is_token_exhausted) {
                let fallback = match step.assigned_role.as_str() {
                    "plan_manager" => workflow.plan_manager_fallback.as_ref(),
                    "developer" => workflow.developer_fallback.as_ref(),
                    "tester" => workflow.tester_fallback.as_ref(),
                    _ => None,
                };

                if let Some(fb_agent) = fallback {
                    if step.fallback_agent_used.is_none() {
                        let log = format!("Rate limit/token quota reached on {}. Auto-fallback to {}.", step.assigned_agent_id, fb_agent);
                        db.update_team_workflow_step_fallback(
                            step_id,
                            fb_agent,
                            fb_agent,
                            "pending",
                            Some(&log),
                        ).map_err(|e| e.to_string())?;

                        return db.get_team_workflow_by_id(workflow_id)
                            .map_err(|e| e.to_string())?
                            .ok_or_else(|| "Workflow not found".to_string());
                    }
                }
            }

            let retry = if status == "failed" {
                step.retry_count + 1
            } else {
                step.retry_count
            };

            let completed_at = if status == "completed" || (status == "failed" && retry >= 3) {
                Some(now.as_str())
            } else {
                None
            };

            db.update_team_workflow_step(
                step_id,
                status,
                retry,
                verification_report,
                error_log,
                None,
                completed_at,
            ).map_err(|e| e.to_string())?;

            let next_index = if status == "completed" {
                workflow.current_step_index + 1
            } else {
                workflow.current_step_index
            };

            let all_completed = steps.iter().all(|s| {
                if s.id == step_id {
                    status == "completed"
                } else {
                    s.status == "completed"
                }
            });

            let new_phase = if all_completed {
                "reviewing"
            } else if status == "failed" && retry >= 3 {
                "failed"
            } else {
                match step.assigned_role.as_str() {
                    "plan_manager" => "developing",
                    "developer" => "testing",
                    "tester" => "developing",
                    _ => "developing",
                }
            };

            db.update_team_workflow_phase(
                workflow_id,
                new_phase,
                next_index,
                None,
                None,
                None,
                if all_completed { Some(&now) } else { None },
            ).map_err(|e| e.to_string())?;

            workflow.phase = new_phase.to_string();
            workflow.current_step_index = next_index;
        }

        Ok(workflow)
    }

    pub fn trigger_fallback(
        db: &DbManager,
        workflow_id: &str,
        step_id: &str,
    ) -> Result<TeamWorkflowStep, String> {
        let workflow = db
            .get_team_workflow_by_id(workflow_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Workflow '{}' not found", workflow_id))?;

        let steps = db
            .list_team_workflow_steps(workflow_id)
            .map_err(|e| e.to_string())?;

        let step = steps
            .into_iter()
            .find(|s| s.id == step_id)
            .ok_or_else(|| format!("Step '{}' not found", step_id))?;

        let fallback_agent = match step.assigned_role.as_str() {
            "plan_manager" => workflow.plan_manager_fallback.clone(),
            "developer" => workflow.developer_fallback.clone(),
            "tester" => workflow.tester_fallback.clone(),
            _ => None,
        }.ok_or_else(|| format!("No fallback agent configured for role '{}'", step.assigned_role))?;

        let log = format!("Token quota fallback triggered. Switched from {} to {}.", step.assigned_agent_id, fallback_agent);
        db.update_team_workflow_step_fallback(
            step_id,
            &fallback_agent,
            &fallback_agent,
            "pending",
            Some(&log),
        ).map_err(|e| e.to_string())?;

        let updated_steps = db
            .list_team_workflow_steps(workflow_id)
            .map_err(|e| e.to_string())?;

        updated_steps
            .into_iter()
            .find(|s| s.id == step_id)
            .ok_or_else(|| "Updated step not found".to_string())
    }

    pub fn retry_step(
        db: &DbManager,
        workflow_id: &str,
        step_id: &str,
    ) -> Result<TeamWorkflowStep, String> {
        let steps = db
            .list_team_workflow_steps(workflow_id)
            .map_err(|e| e.to_string())?;

        let step = steps
            .into_iter()
            .find(|s| s.id == step_id)
            .ok_or_else(|| format!("Step '{}' not found", step_id))?;

        if step.retry_count >= 3 {
            return Err("Maximum retry limit (3) reached for this step. Please review manually.".to_string());
        }

        let new_retry = step.retry_count + 1;
        let now = Utc::now().to_rfc3339();

        db.update_team_workflow_step(
            step_id,
            "running",
            new_retry,
            None,
            None,
            Some(&now),
            None,
        ).map_err(|e| e.to_string())?;

        db.update_team_workflow_phase(
            workflow_id,
            "developing",
            step.step_number - 1,
            None,
            None,
            None,
            None,
        ).map_err(|e| e.to_string())?;

        let updated_steps = db
            .list_team_workflow_steps(workflow_id)
            .map_err(|e| e.to_string())?;

        updated_steps
            .into_iter()
            .find(|s| s.id == step_id)
            .ok_or_else(|| "Updated step not found".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::db::{NewProject, NewTeamWorkflowStep};

    #[test]
    fn test_team_coordinator_lifecycle() {
        let db = DbManager::new_in_memory().expect("db init failed");

        let project = db.create_project(NewProject {
            name: "TeamTest".to_string(),
            path: "C:\\TeamTest".to_string(),
            stack_json: "{}".to_string(),
        }).expect("project creation failed");

        let workflow = TeamCoordinator::start_workflow(
            &db,
            project.id.clone(),
            "Add Payment Gateway".to_string(),
            "Integrate Stripe payments".to_string(),
            false,
            "claude".to_string(),
            Some("antigravity".to_string()),
            "codex".to_string(),
            Some("claude".to_string()),
            "antigravity".to_string(),
            Some("codex".to_string()),
        ).expect("workflow start failed");

        assert_eq!(workflow.phase, "planning");

        // Add Step 1
        let step1 = db.create_team_workflow_step(NewTeamWorkflowStep {
            workflow_id: workflow.id.clone(),
            step_number: 1,
            title: "Stripe Webhook Handler".to_string(),
            description: "Handle checkout.session.completed".to_string(),
            assigned_role: "developer".to_string(),
            assigned_agent_id: "codex".to_string(),
            fallback_agent_used: None,
            test_command: Some("pnpm test".to_string()),
        }).expect("create step failed");

        // Advance step
        let updated_wf = TeamCoordinator::advance_step(
            &db,
            &workflow.id,
            &step1.id,
            "completed",
            Some("100% test coverage"),
            None,
        ).expect("advance step failed");

        assert_eq!(updated_wf.current_step_index, 1);
        assert_eq!(updated_wf.phase, "reviewing");
    }

    #[test]
    fn test_coordinator_token_fallback() {
        let db = DbManager::new_in_memory().expect("db init failed");

        let project = db.create_project(NewProject {
            name: "FallbackTest".to_string(),
            path: "C:\\FallbackTest".to_string(),
            stack_json: "{}".to_string(),
        }).expect("project creation failed");

        let workflow = TeamCoordinator::start_workflow(
            &db,
            project.id.clone(),
            "Build Feature".to_string(),
            "Feature with fallback".to_string(),
            false,
            "claude".to_string(),
            Some("antigravity".to_string()),
            "codex".to_string(),
            Some("claude".to_string()),
            "antigravity".to_string(),
            None,
        ).expect("workflow start failed");

        let step1 = db.create_team_workflow_step(NewTeamWorkflowStep {
            workflow_id: workflow.id.clone(),
            step_number: 1,
            title: "Step with rate limit".to_string(),
            description: "Will hit 429".to_string(),
            assigned_role: "developer".to_string(),
            assigned_agent_id: "codex".to_string(),
            fallback_agent_used: None,
            test_command: None,
        }).expect("create step failed");

        // Simulate 429 quota exhaustion failure
        let updated_wf = TeamCoordinator::advance_step(
            &db,
            &workflow.id,
            &step1.id,
            "failed",
            None,
            Some("Error: 429 Too Many Requests - insufficient_quota"),
        ).expect("advance step failed");

        let steps = db.list_team_workflow_steps(&workflow.id).expect("list steps failed");
        // Step should have auto-switched to developer fallback: claude
        assert_eq!(steps[0].assigned_agent_id, "claude");
        assert_eq!(steps[0].fallback_agent_used, Some("claude".to_string()));
        assert_eq!(steps[0].status, "pending");
        assert_eq!(updated_wf.phase, "planning");

        // Also test manual fallback trigger
        let manual_step = TeamCoordinator::trigger_fallback(
            &db,
            &workflow.id,
            &step1.id,
        ).expect("trigger fallback failed");
        assert_eq!(manual_step.assigned_agent_id, "claude");
    }
}

