import { create } from "zustand";
import { IpcService } from "../services/ipc";

interface TerminalState {
  activeSessionId: string | null;
  isOpen: boolean;
  isSpawning: boolean;
  error: string | null;

  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  spawnSession: (projectId?: string) => Promise<string | null>;
  writeToTerminal: (data: string) => Promise<void>;
  resizeTerminal: (cols: number, rows: number) => Promise<void>;
  killSession: () => Promise<void>;
  clearError: () => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  activeSessionId: null,
  isOpen: false,
  isSpawning: false,
  error: null,

  toggleDrawer: () => set((s) => ({ isOpen: !s.isOpen })),
  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),

  spawnSession: async (projectId) => {
    try {
      set({ isSpawning: true, error: null });
      const current = get().activeSessionId;
      if (current) {
        await IpcService.terminalKill(current);
      }

      const sessionId = await IpcService.terminalSpawn(projectId);
      set({ activeSessionId: sessionId, isSpawning: false, isOpen: true });
      return sessionId;
    } catch (err: unknown) {
      set({ error: String(err), isSpawning: false });
      return null;
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
