import { create } from "zustand";
import { IpcService } from "../services/ipc";
import type {
  TeamWorkflow,
  TeamWorkflowStep,
  TeamConfig,
  GitHubPrResult,
} from "@ai-orchestrator/shared-types";

interface TeamState {
  workflows: TeamWorkflow[];
  activeWorkflow: TeamWorkflow | null;
  steps: TeamWorkflowStep[];
  config: TeamConfig;
  isLoading: boolean;
  error: string | null;
  prResult: GitHubPrResult | null;
  isPrModalOpen: boolean;

  loadWorkflows: (projectId: string) => Promise<void>;
  selectWorkflow: (workflowId: string) => Promise<void>;
  startWorkflow: (params: {
    projectId: string;
    title: string;
    goal: string;
    isGreenfield: boolean;
  }) => Promise<TeamWorkflow | null>;
  addStep: (params: {
    workflowId: string;
    stepNumber: number;
    title: string;
    description: string;
    assignedRole: string;
    assignedAgentId: string;
    testCommand?: string;
  }) => Promise<void>;
  advanceStep: (params: {
    workflowId: string;
    stepId: string;
    status: string;
    verificationReport?: string;
    errorLog?: string;
  }) => Promise<void>;
  retryStep: (stepId: string) => Promise<void>;
  triggerFallback: (stepId: string) => Promise<void>;
  createPr: (params: {
    projectId: string;
    branchName: string;
    baseBranch?: string;
    title: string;
    body: string;
    githubRepoUrl?: string;
  }) => Promise<GitHubPrResult | null>;
  setConfig: (config: Partial<TeamConfig>) => void;
  setPrModalOpen: (open: boolean) => void;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  workflows: [],
  activeWorkflow: null,
  steps: [],
  config: {
    planManagerAgentId: "claude",
    planManagerFallbackAgentId: "antigravity",
    developerAgentId: "codex",
    developerFallbackAgentId: "claude",
    testerAgentId: "antigravity",
    testerFallbackAgentId: "codex",
    maxRetries: 3,
    autoPr: true,
  },
  isLoading: false,
  error: null,
  prResult: null,
  isPrModalOpen: false,

  loadWorkflows: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const workflows = await IpcService.teamListWorkflows(projectId);
      set({ workflows });
      if (workflows.length > 0 && !get().activeWorkflow) {
        await get().selectWorkflow(workflows[0].id);
      }
    } catch (err: unknown) {
      set({ error: String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  selectWorkflow: async (workflowId: string) => {
    try {
      set({ isLoading: true, error: null });
      const wf = await IpcService.teamGetWorkflow(workflowId);
      const steps = await IpcService.teamListWorkflowSteps(workflowId);
      set({ activeWorkflow: wf, steps });
    } catch (err: unknown) {
      set({ error: String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  startWorkflow: async ({ projectId, title, goal, isGreenfield }) => {
    try {
      set({ isLoading: true, error: null });
      const { config } = get();

      const wf = await IpcService.teamStartWorkflow({
        projectId,
        title,
        goal,
        isGreenfield,
        planManagerAgentId: config.planManagerAgentId,
        planManagerFallback: config.planManagerFallbackAgentId,
        developerAgentId: config.developerAgentId,
        developerFallback: config.developerFallbackAgentId,
        testerAgentId: config.testerAgentId,
        testerFallback: config.testerFallbackAgentId,
      });

      // Automatically initialize default steps based on project mode
      if (isGreenfield) {
        await IpcService.teamAddStep({
          workflowId: wf.id,
          stepNumber: 1,
          title: "Architecture & Tech Stack Planning",
          description: `Analyze requirements and generate project scaffolding specification for: ${goal}`,
          assignedRole: "plan_manager",
          assignedAgentId: config.planManagerAgentId,
        });

        await IpcService.teamAddStep({
          workflowId: wf.id,
          stepNumber: 2,
          title: "Project Scaffolding & Initial Codebase",
          description: "Initialize project structure, configuration files, and core dependencies",
          assignedRole: "developer",
          assignedAgentId: config.developerAgentId,
          testCommand: "pnpm build",
        });

        await IpcService.teamAddStep({
          workflowId: wf.id,
          stepNumber: 3,
          title: "Build & Smoke Test Verification",
          description: "Execute build and automated tests to verify project boots cleanly",
          assignedRole: "tester",
          assignedAgentId: config.testerAgentId,
          testCommand: "pnpm test",
        });
      } else {
        await IpcService.teamAddStep({
          workflowId: wf.id,
          stepNumber: 1,
          title: "Task Breakdown & Implementation Spec",
          description: `Analyze existing codebase context and create atomic implementation plan for: ${goal}`,
          assignedRole: "plan_manager",
          assignedAgentId: config.planManagerAgentId,
        });

        await IpcService.teamAddStep({
          workflowId: wf.id,
          stepNumber: 2,
          title: "Feature Implementation & Unit Tests",
          description: `Implement required changes and unit tests for: ${title}`,
          assignedRole: "developer",
          assignedAgentId: config.developerAgentId,
          testCommand: "pnpm test",
        });

        await IpcService.teamAddStep({
          workflowId: wf.id,
          stepNumber: 3,
          title: "Automated QA & Regression Verification",
          description: "Execute full test suite to guarantee zero regression before PR",
          assignedRole: "tester",
          assignedAgentId: config.testerAgentId,
          testCommand: "pnpm test",
        });
      }

      const steps = await IpcService.teamListWorkflowSteps(wf.id);
      const currentList = get().workflows;
      set({
        workflows: [wf, ...currentList],
        activeWorkflow: wf,
        steps,
      });

      return wf;
    } catch (err: unknown) {
      set({ error: String(err) });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  addStep: async (params) => {
    try {
      await IpcService.teamAddStep(params);
      const steps = await IpcService.teamListWorkflowSteps(params.workflowId);
      set({ steps });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  advanceStep: async (params) => {
    try {
      const updatedWf = await IpcService.teamAdvanceStep(params);
      const steps = await IpcService.teamListWorkflowSteps(params.workflowId);
      set({ activeWorkflow: updatedWf, steps });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  retryStep: async (stepId: string) => {
    const { activeWorkflow } = get();
    if (!activeWorkflow) return;
    try {
      await IpcService.teamRetryStep(activeWorkflow.id, stepId);
      const steps = await IpcService.teamListWorkflowSteps(activeWorkflow.id);
      const updatedWf = await IpcService.teamGetWorkflow(activeWorkflow.id);
      set({ activeWorkflow: updatedWf, steps });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  triggerFallback: async (stepId: string) => {
    const { activeWorkflow } = get();
    if (!activeWorkflow) return;
    try {
      await IpcService.teamTriggerFallback(activeWorkflow.id, stepId);
      const steps = await IpcService.teamListWorkflowSteps(activeWorkflow.id);
      const updatedWf = await IpcService.teamGetWorkflow(activeWorkflow.id);
      set({ activeWorkflow: updatedWf, steps });
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  createPr: async (params) => {
    try {
      set({ isLoading: true, error: null });
      const res = await IpcService.gitCreatePr(params);
      set({ prResult: res, isPrModalOpen: true });
      return res;
    } catch (err: unknown) {
      set({ error: String(err) });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  setConfig: (partial) => {
    set((state) => ({ config: { ...state.config, ...partial } }));
  },

  setPrModalOpen: (open) => set({ isPrModalOpen: open }),
}));
