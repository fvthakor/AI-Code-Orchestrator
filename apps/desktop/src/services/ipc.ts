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
} from "@ai-orchestrator/shared-types";

export interface GitCommitInfo {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
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

  async executionGet(executionId: string): Promise<Execution | null> {
    return await invoke<Execution | null>("execution_get", { executionId });
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

  // Security
  async securityEvaluate(command: string, projectId?: string): Promise<PolicyEvaluation> {
    return await invoke<PolicyEvaluation>("security_evaluate", { command, projectId });
  },
};

type u16 = number;
