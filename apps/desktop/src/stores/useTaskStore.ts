import { create } from "zustand";
import type { Task } from "@ai-orchestrator/shared-types";
import { IpcService } from "../services/ipc";

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  isLoading: boolean;
  error: string | null;

  loadTasks: (projectId: string) => Promise<void>;
  createTask: (
    projectId: string,
    title: string,
    description: string,
    agentId?: string
  ) => Promise<Task | null>;
  deleteTask: (taskId: string) => Promise<void>;
  updateStatus: (taskId: string, status: string) => Promise<void>;
  setActiveTaskId: (taskId: string | null) => void;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  activeTaskId: null,
  isLoading: false,
  error: null,

  loadTasks: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const tasks = await IpcService.taskList(projectId);
      set({ tasks, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  createTask: async (projectId, title, description, agentId) => {
    try {
      set({ isLoading: true, error: null });
      const task = await IpcService.taskCreate(projectId, title, description, agentId);
      const tasks = await IpcService.taskList(projectId);
      set({ tasks, activeTaskId: task.id, isLoading: false });
      return task;
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  deleteTask: async (taskId: string) => {
    try {
      set({ isLoading: true, error: null });
      await IpcService.taskDelete(taskId);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
        isLoading: false,
      }));
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  updateStatus: async (taskId, status) => {
    try {
      await IpcService.taskUpdateStatus(taskId, status);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: status as any } : t)),
      }));
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  setActiveTaskId: (taskId) => set({ activeTaskId: taskId }),
  clearError: () => set({ error: null }),
}));
