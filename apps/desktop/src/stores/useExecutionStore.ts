import { create } from "zustand";
import type { Execution, ActiveAgentTaskInfo } from "@ai-orchestrator/shared-types";
import { IpcService } from "../services/ipc";

interface ExecutionState {
  executions: Execution[];
  allExecutions: Execution[];
  activeExecutionId: string | null;
  activeAgentTask: ActiveAgentTaskInfo | null;
  terminalLogs: Record<string, string>;
  isLoading: boolean;
  error: string | null;

  loadExecutions: (projectId: string) => Promise<void>;
  loadAllExecutions: (limit?: number) => Promise<void>;
  loadActiveAgentTask: () => Promise<ActiveAgentTaskInfo | null>;
  clearActiveLock: () => Promise<void>;
  runAgentTask: (taskId: string, agentId: string) => Promise<string | null>;
  runProjectCommand: (projectId: string, command: string) => Promise<string | null>;
  appendLog: (executionId: string, chunk: string) => void;
  setActiveExecutionId: (id: string | null) => void;
  clearError: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: [],
  allExecutions: [],
  activeExecutionId: null,
  activeAgentTask: null,
  terminalLogs: {},
  isLoading: false,
  error: null,

  loadExecutions: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const executions = await IpcService.executionList(projectId);
      set({ executions, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadAllExecutions: async (limit = 50) => {
    try {
      const allExecutions = await IpcService.executionListAll(limit);
      set({ allExecutions });
    } catch {
      // ignore
    }
  },

  loadActiveAgentTask: async () => {
    try {
      const activeAgentTask = await IpcService.executionGetActiveAgentTask();
      set({ activeAgentTask });
      return activeAgentTask;
    } catch {
      return null;
    }
  },

  clearActiveLock: async () => {
    try {
      await IpcService.executionClearActiveLock();
      set({ activeAgentTask: null });
    } catch {
      // ignore
    }
  },

  runAgentTask: async (taskId: string, agentId: string) => {
    try {
      set({ isLoading: true, error: null });

      // Enforce sequential execution lock
      const currentActive = await get().loadActiveAgentTask();
      if (currentActive) {
        const lockMsg = `Task execution locked: '${currentActive.title}' is currently running on '${currentActive.projectName}'. Only one agent task can execute at a time.`;
        set({ error: lockMsg, isLoading: false });
        return null;
      }

      const executionId = await IpcService.executionRunAgent(taskId, agentId);
      set({ activeExecutionId: executionId, isLoading: false });
      await get().loadActiveAgentTask();

      // Subscribe to live output
      await IpcService.onTerminalOutput(executionId, (output) => {
        get().appendLog(executionId, output);
      });

      return executionId;
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  runProjectCommand: async (projectId: string, command: string) => {
    try {
      set({ isLoading: true, error: null });
      const executionId = await IpcService.executionRunCommand(projectId, command);
      set({ activeExecutionId: executionId, isLoading: false });

      await IpcService.onTerminalOutput(executionId, (output) => {
        get().appendLog(executionId, output);
      });

      return executionId;
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  appendLog: (executionId, chunk) => {
    set((state) => ({
      terminalLogs: {
        ...state.terminalLogs,
        [executionId]: (state.terminalLogs[executionId] || "") + chunk,
      },
    }));
  },

  setActiveExecutionId: (id) => set({ activeExecutionId: id }),
  clearError: () => set({ error: null }),
}));
