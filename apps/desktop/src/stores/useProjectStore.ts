import { create } from "zustand";
import type { ProjectContext } from "@ai-orchestrator/shared-types";
import { IpcService } from "../services/ipc";

interface ProjectState {
  currentProject: ProjectContext | null;
  projects: ProjectContext[];
  isLoading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  openProject: (path: string) => Promise<ProjectContext | null>;
  selectDirectoryAndOpen: () => Promise<ProjectContext | null>;
  analyzeProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setCurrentProject: (project: ProjectContext | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projects: [],
  isLoading: false,
  error: null,

  loadProjects: async () => {
    try {
      set({ isLoading: true, error: null });
      const projects = await IpcService.projectList();
      set({ projects, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  openProject: async (path: string) => {
    try {
      set({ isLoading: true, error: null });
      const project = await IpcService.projectOpen(path);
      const projects = await IpcService.projectList();
      set({ currentProject: project, projects, isLoading: false });
      return project;
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  selectDirectoryAndOpen: async () => {
    const selected = await IpcService.selectDirectory();
    if (!selected) return null;
    return await get().openProject(selected);
  },

  analyzeProject: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await IpcService.projectAnalyze(projectId);
      set((state) => ({
        currentProject: state.currentProject?.id === projectId ? updated : state.currentProject,
        projects: state.projects.map((p) => (p.id === projectId ? updated : p)),
        isLoading: false,
      }));
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      await IpcService.projectDelete(projectId);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
        isLoading: false,
      }));
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),
  clearError: () => set({ error: null }),
}));
