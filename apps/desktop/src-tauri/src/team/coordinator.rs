use chrono::Utc;
use crate::database::DbManager;
use crate::models::db::{NewTeamWorkflow, TeamWorkflow, TeamWorkflowStep};

pub struct TeamCoordinator;

impl TeamCoordinator {
    pub fn start_workflow(
        db: &DbManager,
        project_id: String,
        title: String,
        goal: String,
        is_greenfield: bool,
        plan_manager_agent_id: String,
        developer_agent_id: String,
        tester_agent_id: String,
    ) -> Result<TeamWorkflow, String> {
        let workflow = db
            .create_team_workflow(NewTeamWorkflow {
                project_id,
                title,
                goal,
                is_greenfield,
                plan_manager_agent_id,
                developer_agent_id,
                tester_agent_id,
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
            "codex".to_string(),
            "antigravity".to_string(),
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
}

