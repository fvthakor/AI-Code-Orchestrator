import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type {
  ProjectContext,
  AgentInfo,
  Task,
  Execution,
  GitContext,
  GitCommitOptions,
  PolicyEvaluation,
  TeamWorkflow,
  TeamWorkflowStep,
  GitHubPrRequest,
  GitHubPrResult,
  ActiveAgentTaskInfo,
  GlobalStats,
} from "@ai-orchestrator/shared-types";

export interface GitCommitInfo {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface QaStaticCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface QaStaticReport {
  passed: boolean;
  checks: QaStaticCheck[];
}

export interface QaGapReport {
  gaps: string[];
  envVars: string[];
  ports: string[];
  hasPackageJson: boolean;
  hasStartScript: boolean;
  hasE2eScript: boolean;
  hasRunSection: boolean;
}

export const IpcService = {
  // Dialog
  async selectDirectory(): Promise<string | null> {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });
      return selected as string | null;
    } catch (err) {
      console.error("Failed to open directory dialog:", err);
      return null;
    }
  },

  // Projects
  async projectOpen(path: string): Promise<ProjectContext> {
    return await invoke<ProjectContext>("project_open", { path });
  },

  async projectAnalyze(projectId: string): Promise<ProjectContext> {
    return await invoke<ProjectContext>("project_analyze", { projectId });
  },

  async projectList(): Promise<ProjectContext[]> {
    return await invoke<ProjectContext[]>("project_list");
  },

  async projectDelete(projectId: string): Promise<void> {
    return await invoke<void>("project_delete", { projectId });
  },

  async projectSavePlan(projectId: string, planContent: string): Promise<string> {
    return await invoke<string>("project_save_plan", { projectId, planContent });
  },

  // Agents
  async agentDetectAll(): Promise<AgentInfo[]> {
    return await invoke<AgentInfo[]>("agent_detect_all");
  },

  async agentSaveConfig(
    id: string,
    name: string,
    enabled: boolean,
    customPath?: string,
    settingsJson?: string
  ): Promise<void> {
    return await invoke<void>("agent_save_config", {
      id,
      name,
      enabled,
      customPath,
      settingsJson,
    });
  },

  async agentTestConnection(agentId: string, customPath?: string): Promise<AgentInfo> {
    return await invoke<AgentInfo>("agent_test_connection", { agentId, customPath });
  },

  // Tasks
  async taskCreate(
    projectId: string,
    title: string,
    description: string,
    agentId?: string
  ): Promise<Task> {
    return await invoke<Task>("task_create", { projectId, title, description, agentId });
  },

  async taskList(projectId: string): Promise<Task[]> {
    return await invoke<Task[]>("task_list", { projectId });
  },

  async taskListAll(limit = 50): Promise<Task[]> {
    return await invoke<Task[]>("task_list_all", { limit });
  },

  async taskGet(taskId: string): Promise<Task | null> {
    return await invoke<Task | null>("task_get", { taskId });
  },

  async taskUpdateStatus(taskId: string, status: string): Promise<void> {
    return await invoke<void>("task_update_status", { taskId, status });
  },

  async taskDelete(taskId: string): Promise<void> {
    return await invoke<void>("task_delete", { taskId });
  },

  // Executions
  async executionList(projectId: string): Promise<Execution[]> {
    return await invoke<Execution[]>("execution_list", { projectId });
  },

  async executionListAll(limit = 50): Promise<Execution[]> {
    return await invoke<Execution[]>("execution_list_all", { limit });
  },

  async executionGet(executionId: string): Promise<Execution | null> {
    return await invoke<Execution | null>("execution_get", { executionId });
  },

  async executionGetActiveAgentTask(): Promise<ActiveAgentTaskInfo | null> {
    return await invoke<ActiveAgentTaskInfo | null>("execution_get_active_agent_task");
  },

  async executionClearActiveLock(): Promise<void> {
    await invoke<void>("execution_clear_active_lock");
  },

  async executionRunAgent(taskId: string, agentId: string): Promise<string> {
    return await invoke<string>("execution_run_agent", { taskId, agentId });
  },

  async executionRunCommand(projectId: string, command: string): Promise<string> {
    return await invoke<string>("execution_run_command", { projectId, command });
  },

  // Terminal
  async terminalSpawn(projectId?: string, cols = 80, rows = 24): Promise<string> {
    return await invoke<string>("terminal_spawn", { projectId, cols, rows });
  },

  async terminalWrite(sessionId: string, data: string): Promise<void> {
    return await invoke<void>("terminal_write", { sessionId, data });
  },

  async terminalResize(sessionId: string, cols: u16 = 80, rows: u16 = 24): Promise<void> {
    return await invoke<void>("terminal_resize", { sessionId, cols, rows });
  },

  async terminalKill(sessionId: string): Promise<void> {
    return await invoke<void>("terminal_kill", { sessionId });
  },

  // Event listener for PTY streaming
  onTerminalOutput(sessionIdOrExecutionId: string, callback: (output: string) => void): Promise<UnlistenFn> {
    return listen<string>(`terminal-output:${sessionIdOrExecutionId}`, (event) => {
      callback(event.payload);
    });
  },

  // Git
  async gitStatus(projectId: string): Promise<GitContext> {
    return await invoke<GitContext>("git_status", { projectId });
  },

  async gitDiff(projectId: string, file?: string): Promise<string> {
    return await invoke<string>("git_diff", { projectId, file });
  },

  async gitLog(projectId: string, count = 20): Promise<GitCommitInfo[]> {
    return await invoke<GitCommitInfo[]>("git_log", { projectId, count });
  },

  async gitCommit(projectId: string, options: GitCommitOptions): Promise<string> {
    return await invoke<string>("git_commit", {
      projectId,
      message: options.message,
      files: options.files,
    });
  },

  async gitInitOrLink(projectId: string, remoteUrl?: string, defaultBranch?: string): Promise<string> {
    return await invoke<string>("git_init_or_link", { projectId, remoteUrl, defaultBranch });
  },

  async gitCreateBranch(projectId: string, branchName: string): Promise<void> {
    return await invoke<void>("git_create_branch", { projectId, branchName });
  },

  async gitPrepareTaskBranch(
    projectId: string,
    taskSlug: string,
    baseBranch?: string
  ): Promise<string> {
    return await invoke<string>("git_prepare_task_branch", { projectId, taskSlug, baseBranch });
  },

  async gitCommitAndPush(
    projectId: string,
    branchName: string,
    message: string
  ): Promise<string> {
    return await invoke<string>("git_commit_and_push", { projectId, branchName, message });
  },

  async qaStaticChecks(projectId: string): Promise<QaStaticReport> {
    return await invoke<QaStaticReport>("qa_static_checks", { projectId });
  },

  async qaGapReport(projectId: string): Promise<QaGapReport> {
    return await invoke<QaGapReport>("qa_gap_report", { projectId });
  },

  async environmentCheck(): Promise<{ name: string; ok: boolean; detail: string }[]> {
    return await invoke<{ name: string; ok: boolean; detail: string }[]>("environment_check");
  },

  async environmentInstall(tool: string): Promise<string> {
    return await invoke<string>("environment_install", { tool });
  },

  async executionStop(executionId: string): Promise<void> {
    return await invoke<void>("execution_stop", { executionId });
  },

  async executionIsRunning(executionId: string): Promise<boolean> {
    return await invoke<boolean>("execution_is_running", { executionId });
  },

  async powerKeepAwake(enabled: boolean): Promise<void> {
    return await invoke<void>("power_keep_awake", { enabled });
  },

  async autopilotSaveState(projectId: string, stateJson: string): Promise<void> {
    return await invoke<void>("autopilot_save_state", { projectId, stateJson });
  },

  async autopilotLoadState(projectId: string): Promise<string | null> {
    return await invoke<string | null>("autopilot_load_state", { projectId });
  },

  async gitBootstrapRepo(projectId: string): Promise<{ baseBranch: string; hasRemote: boolean; createdInitialCommit: boolean }> {
    return await invoke<{ baseBranch: string; hasRemote: boolean; createdInitialCommit: boolean }>("git_bootstrap_repo", { projectId });
  },

  async gitResumeTaskBranch(projectId: string, branchName: string): Promise<string> {
    return await invoke<string>("git_resume_task_branch", { projectId, branchName });
  },

  async gitPush(projectId: string, branchName: string): Promise<string> {
    return await invoke<string>("git_push", { projectId, branchName });
  },

  async gitCreatePr(request: GitHubPrRequest): Promise<GitHubPrResult> {
    return await invoke<GitHubPrResult>("git_create_pr", { request });
  },

  async gitIsBranchMerged(
    projectId: string,
    branchName: string,
    baseBranch?: string
  ): Promise<boolean> {
    return await invoke<boolean>("git_is_branch_merged", { projectId, branchName, baseBranch });
  },

  async gitMergeBranchLocally(
    projectId: string,
    branchName: string,
    baseBranch?: string
  ): Promise<string> {
    return await invoke<string>("git_merge_branch_locally", { projectId, branchName, baseBranch });
  },

  // Team Orchestration
  async teamStartWorkflow(params: {
    projectId: string;
    title: string;
    goal: string;
    isGreenfield: boolean;
    planManagerAgentId: string;
    planManagerFallback?: string;
    developerAgentId: string;
    developerFallback?: string;
    testerAgentId: string;
    testerFallback?: string;
  }): Promise<TeamWorkflow> {
    return await invoke<TeamWorkflow>("team_start_workflow", params);
  },

  async teamGetWorkflow(workflowId: string): Promise<TeamWorkflow | null> {
    return await invoke<TeamWorkflow | null>("team_get_workflow", { workflowId });
  },

  async teamListWorkflows(projectId: string): Promise<TeamWorkflow[]> {
    return await invoke<TeamWorkflow[]>("team_list_workflows", { projectId });
  },

  async teamListWorkflowSteps(workflowId: string): Promise<TeamWorkflowStep[]> {
    return await invoke<TeamWorkflowStep[]>("team_list_workflow_steps", { workflowId });
  },

  async teamAddStep(params: {
    workflowId: string;
    stepNumber: number;
    title: string;
    description: string;
    assignedRole: string;
    assignedAgentId: string;
    testCommand?: string;
  }): Promise<TeamWorkflowStep> {
    return await invoke<TeamWorkflowStep>("team_add_step", params);
  },

  async teamAdvanceStep(params: {
    workflowId: string;
    stepId: string;
    status: string;
    verificationReport?: string;
    errorLog?: string;
  }): Promise<TeamWorkflow> {
    return await invoke<TeamWorkflow>("team_advance_step", params);
  },

  async teamRetryStep(workflowId: string, stepId: string): Promise<TeamWorkflowStep> {
    return await invoke<TeamWorkflowStep>("team_retry_step", { workflowId, stepId });
  },

  async teamTriggerFallback(workflowId: string, stepId: string): Promise<TeamWorkflowStep> {
    return await invoke<TeamWorkflowStep>("team_trigger_fallback", { workflowId, stepId });
  },

  async teamListAllWorkflows(): Promise<TeamWorkflow[]> {
    return await invoke<TeamWorkflow[]>("team_list_all_workflows");
  },

  // Global Statistics
  async statsGetGlobal(): Promise<GlobalStats> {
    return await invoke<GlobalStats>("stats_get_global");
  },

  // Security
  async securityEvaluate(command: string, projectId?: string): Promise<PolicyEvaluation> {
    return await invoke<PolicyEvaluation>("security_evaluate", { command, projectId });
  },
};

type u16 = number;
