import { create } from "zustand";
import { IpcService } from "../services/ipc";

interface TerminalState {
  activeSessionId: string | null;
  activeExecutionId: string | null;
  activeTab: "agent" | "shell";
  isOpen: boolean;
  isSpawning: boolean;
  error: string | null;

  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setTab: (tab: "agent" | "shell") => void;
  openAgentStream: (executionId?: string) => void;
  openShellStream: () => void;
  spawnSession: (projectId?: string) => Promise<string | null>;
  launchCliLogin: (agentId: string, projectId?: string) => Promise<void>;
  writeToTerminal: (data: string) => Promise<void>;
  resizeTerminal: (cols: number, rows: number) => Promise<void>;
  killSession: () => Promise<void>;
  clearError: () => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  activeSessionId: null,
  activeExecutionId: null,
  activeTab: "agent",
  isOpen: false,
  isSpawning: false,
  error: null,

  toggleDrawer: () => set((s) => ({ isOpen: !s.isOpen })),
  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),

  setTab: (tab: "agent" | "shell") => set({ activeTab: tab }),

  openAgentStream: (executionId?: string) => {
    set((s) => ({
      isOpen: true,
      activeTab: "agent",
      activeExecutionId: executionId !== undefined ? executionId : s.activeExecutionId,
    }));
  },

  openShellStream: () => {
    set({ isOpen: true, activeTab: "shell" });
  },

  spawnSession: async (projectId) => {
    try {
      set({ isSpawning: true, error: null });
      const current = get().activeSessionId;
      if (current) {
        await IpcService.terminalKill(current);
      }

      const sessionId = await IpcService.terminalSpawn(projectId);
      set({ activeSessionId: sessionId, isSpawning: false, isOpen: true, activeTab: "shell" });
      return sessionId;
    } catch (err: unknown) {
      set({ error: String(err), isSpawning: false });
      return null;
    }
  },

  launchCliLogin: async (agentId: string, projectId?: string) => {
    let command = "claude login\r\n";
    if (agentId === "codex") {
      command = "codex login\r\n";
    } else if (agentId === "antigravity") {
      command = "agy login\r\n";
    } else if (agentId === "opencode") {
      command = "opencode auth login\r\n";
    }

    set({ isOpen: true, activeTab: "shell" });

    let sid = get().activeSessionId;
    if (!sid) {
      sid = await get().spawnSession(projectId);
    }
    // Give powershell ConPTY a brief moment to show prompt if just spawned
    await new Promise((r) => setTimeout(r, 600));
    if (get().activeSessionId) {
      await get().writeToTerminal(command);
    }
  },

  writeToTerminal: async (data: string) => {
    const sid = get().activeSessionId;
    if (!sid) return;
    try {
      await IpcService.terminalWrite(sid, data);
    } catch (err: unknown) {
      console.error("Terminal write error:", err);
    }
  },

  resizeTerminal: async (cols: number, rows: number) => {
    const sid = get().activeSessionId;
    if (!sid) return;
    try {
      await IpcService.terminalResize(sid, cols, rows);
    } catch (err: unknown) {
      console.error("Terminal resize error:", err);
    }
  },

  killSession: async () => {
    const sid = get().activeSessionId;
    if (!sid) return;
    try {
      await IpcService.terminalKill(sid);
      set({ activeSessionId: null });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
