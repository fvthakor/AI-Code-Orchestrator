import { create } from "zustand";
import type { Execution } from "@ai-orchestrator/shared-types";
import { IpcService } from "../services/ipc";

interface ExecutionState {
  executions: Execution[];
  activeExecutionId: string | null;
  terminalLogs: Record<string, string>;
  isLoading: boolean;
  error: string | null;

  loadExecutions: (projectId: string) => Promise<void>;
  runAgentTask: (taskId: string, agentId: string) => Promise<string | null>;
  runProjectCommand: (projectId: string, command: string) => Promise<string | null>;
  appendLog: (executionId: string, chunk: string) => void;
  setActiveExecutionId: (id: string | null) => void;
  clearError: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: [],
  activeExecutionId: null,
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

  runAgentTask: async (taskId: string, agentId: string) => {
    try {
      set({ isLoading: true, error: null });
      const executionId = await IpcService.executionRunAgent(taskId, agentId);
      set({ activeExecutionId: executionId, isLoading: false });

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
