import { create } from "zustand";
import type { AgentInfo } from "@ai-orchestrator/shared-types";
import { IpcService } from "../services/ipc";

interface AgentState {
  agents: AgentInfo[];
  isLoading: boolean;
  error: string | null;

  detectAll: () => Promise<void>;
  saveConfig: (
    id: string,
    name: string,
    enabled: boolean,
    customPath?: string
  ) => Promise<void>;
  testConnection: (id: string, customPath?: string) => Promise<AgentInfo | null>;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  isLoading: false,
  error: null,

  detectAll: async () => {
    try {
      set({ isLoading: true, error: null });
      const agents = await IpcService.agentDetectAll();
      set({ agents, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  saveConfig: async (id, name, enabled, customPath) => {
    try {
      set({ isLoading: true, error: null });
      await IpcService.agentSaveConfig(id, name, enabled, customPath);
      const agents = await IpcService.agentDetectAll();
      set({ agents, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  testConnection: async (id, customPath) => {
    try {
      set({ isLoading: true, error: null });
      const result = await IpcService.agentTestConnection(id, customPath);
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? result : a)),
        isLoading: false,
      }));
      return result;
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
