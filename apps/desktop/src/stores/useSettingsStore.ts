import { create } from "zustand";
import type { AppSettings } from "@ai-orchestrator/shared-types";

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultProjectDirectory: undefined,
  defaultShell: "powershell",
  autoRefreshIntervalSeconds: 5,
  requireApprovalForHighRisk: true,
  terminalFontSize: 13,
  terminalCursorBlink: true,
  theme: "dark",
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: (() => {
    try {
      const saved = localStorage.getItem("ai_orchestrator_settings");
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  })(),

  updateSettings: (partial) => {
    set((state) => {
      const updated = { ...state.settings, ...partial };
      try {
        localStorage.setItem("ai_orchestrator_settings", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return { settings: updated };
    });
  },
}));
