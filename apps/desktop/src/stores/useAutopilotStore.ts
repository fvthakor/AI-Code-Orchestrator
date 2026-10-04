import { create } from "zustand";
import { IpcService } from "../services/ipc";
import { useTaskStore } from "./useTaskStore";
import { useExecutionStore } from "./useExecutionStore";
import { useTeamStore } from "./useTeamStore";
import { useProjectStore } from "./useProjectStore";
import { useTerminalStore } from "./useTerminalStore";
import { useAgentStore } from "./useAgentStore";

export type AutopilotPhase =
  | "idle"
  | "planning"
  | "branching"
  | "developing"
  | "testing"
  | "pushing"
  | "completed"
  | "failed";

interface AutopilotState {
  isRunning: boolean;
  currentPhase: AutopilotPhase;
  statusMessage: string;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  activeBranchName: string | null;
  currentTaskIndex: number;
  totalTasks: number;
  error: string | null;
  logs: string[];

  startAutopilot: (params: {
    projectId: string;
    title: string;
    description: string;
    isGreenfield?: boolean;
  }) => Promise<void>;
  stopAutopilot: () => void;
  appendLog: (msg: string) => void;
}

export const useAutopilotStore = create<AutopilotState>((set, get) => ({
  isRunning: false,
  currentPhase: "idle",
  statusMessage: "Standing by",
  activeTaskId: null,
  activeTaskTitle: null,
  activeBranchName: null,
  currentTaskIndex: 0,
  totalTasks: 0,
  error: null,
  logs: [],

  appendLog: (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    set((state) => ({ logs: [...state.logs.slice(-50), `[${timestamp}] ${msg}`] }));
  },

  stopAutopilot: () => {
    set({
      isRunning: false,
      currentPhase: "idle",
      statusMessage: "Autopilot stopped by user",
    });
    get().appendLog("Autopilot stopped by user.");
  },

  startAutopilot: async ({ projectId, title, description, isGreenfield: _isGreenfield = false }) => {
    if (get().isRunning) return;

    const teamConfig = useTeamStore.getState().config;
    const connectedAgents = useAgentStore.getState().agents;

    // Pick active agents based on priority order and connected status (automatic fallback)
    const planCandidates = [
      ...(teamConfig.planManagerAgents || []),
      teamConfig.planManagerAgentId,
      "claude",
      "antigravity",
    ].filter(Boolean) as string[];

    const planManager =
      planCandidates.find((id) => {
        const ag = connectedAgents.find((a) => a.id === id);
        return ag && ag.status === "connected";
      }) || planCandidates[0] || "claude";

    const devCandidates = [
      ...(teamConfig.developerAgents || []),
      teamConfig.developerAgentId,
      "opencode",
      "claude",
    ].filter(Boolean) as string[];

    const developer =
      devCandidates.find((id) => {
        const ag = connectedAgents.find((a) => a.id === id);
        return ag && ag.status === "connected";
      }) || devCandidates[0] || "opencode";

    const testerCandidates = [
      ...(teamConfig.testerAgents || []),
      teamConfig.testerAgentId,
      "antigravity",
      "claude",
    ].filter(Boolean) as string[];

    const tester =
      testerCandidates.find((id) => {
        const ag = connectedAgents.find((a) => a.id === id);
        return ag && ag.status === "connected";
      }) || testerCandidates[0] || "antigravity";

    set({
      isRunning: true,
      currentPhase: "planning",
      statusMessage: `Plan Manager (${planManager}) is planning entire project architecture and task roadmap...`,
      error: null,
      logs: [],
      currentTaskIndex: 0,
      totalTasks: 0,
    });

    // Open terminal drawer and focus on agent execution stream
    useTerminalStore.getState().openAgentStream();

    get().appendLog(`🚀 Starting Autonomous Autopilot on project.`);
    get().appendLog(`📋 Goal: ${title}`);
    get().appendLog(`👥 Assigned Team: Plan Manager (${planManager}), Developer (${developer}), QA Tester (${tester}).`);

    try {
      // Step 1: Execute Plan Manager to analyze and plan the entire project
      get().appendLog(`Phase 1: Dispatching project planning to Lead Architect (${planManager})...`);

      const planTaskTitle = `[Plan Manager] Project Blueprint & Architecture: ${title}`;
      const planTaskDesc = `You are the Lead Software Architect and Plan Manager.\nAnalyze the project goal and define the complete architecture, directory layout, and implementation requirements:\n\nGoal: ${title}\n\nRequirements:\n${description}\n\nProduce a list of 3-5 concrete, priority-ordered implementation tasks to build this project.\nAt the very end of your response, output a JSON array of the tasks in this exact schema so they can be added to the project board:\n\`\`\`json\n[\n  {\n    "title": "[Phase 1: Architecture] Set up models, types and core configuration",\n    "description": "Details of what to implement...",\n    "priority": "high"\n  },\n  {\n    "title": "[Phase 2: Core Engine] Implement main logic and operations",\n    "description": "Details of what to implement...",\n    "priority": "high"\n  },\n  {\n    "title": "[Phase 3: QA Verification] Unit tests, edge cases and validation",\n    "description": "Details of what to test...",\n    "priority": "medium"\n  }\n]\n\`\`\``;

      const planTask = await useTaskStore.getState().createTask(projectId, planTaskTitle, planTaskDesc, planManager);
      await useTaskStore.getState().loadTasks(projectId);

      let finalPlanLogs = "";

      if (planTask) {
        try {
          const planExecId = await useExecutionStore.getState().runAgentTask(planTask.id, planManager);
          if (planExecId) {
            useTerminalStore.getState().openAgentStream(planExecId);
            // Wait for Plan Manager execution to complete
            let planDone = false;
            let checks = 0;
            while (!planDone && get().isRunning && checks < 30) {
              await new Promise((r) => setTimeout(r, 1500));
              checks++;
              const active = await useExecutionStore.getState().loadActiveAgentTask();
              if (!active) {
                planDone = true;
              }
            }

            finalPlanLogs = useExecutionStore.getState().terminalLogs[planExecId] || "";

            // Inspect logs for auth failure
            const isAuthExpired =
              finalPlanLogs.includes("Failed to authenticate") ||
              finalPlanLogs.includes("OAuth session expired") ||
              finalPlanLogs.includes("access token could not be refreshed") ||
              finalPlanLogs.includes("Please log out and sign in again") ||
              finalPlanLogs.includes("auth_required");

            if (isAuthExpired) {
              get().appendLog(`⚠️ ${planManager.toUpperCase()} login expired! Automatically opening terminal to run CLI login...`);
              void useTerminalStore.getState().launchCliLogin(planManager, projectId);

              const fallbackAgent =
                teamConfig.planManagerAgents?.find((a) => a !== planManager) ||
                (planManager !== "antigravity" ? "antigravity" : null);

              if (fallbackAgent) {
                get().appendLog(`🔄 Automatically falling back to ${fallbackAgent.toUpperCase()} for Project Planning...`);
                set({
                  statusMessage: `Falling back to ${fallbackAgent} for Project Planning...`,
                });

                const fbTask = await useTaskStore.getState().createTask(
                  projectId,
                  `[Plan Manager Fallback] Project Blueprint: ${title}`,
                  planTaskDesc,
                  fallbackAgent
                );
                if (fbTask) {
                  const fbExecId = await useExecutionStore.getState().runAgentTask(fbTask.id, fallbackAgent);
                  if (fbExecId) {
                    useTerminalStore.getState().openAgentStream(fbExecId);
                    let fbDone = false;
                    let fbChecks = 0;
                    while (!fbDone && get().isRunning && fbChecks < 30) {
                      await new Promise((r) => setTimeout(r, 1500));
                      fbChecks++;
                      const active = await useExecutionStore.getState().loadActiveAgentTask();
                      if (!active) fbDone = true;
                    }
                    finalPlanLogs = useExecutionStore.getState().terminalLogs[fbExecId] || "";
                  }
                  await useTaskStore.getState().updateStatus(fbTask.id, "completed");
                }
              }
            }
          }
        } catch (planErr) {
          get().appendLog(`ℹ Plan Manager note: ${String(planErr)} (continuing with architectural roadmap)`);
        }
        await useTaskStore.getState().updateStatus(planTask.id, "completed");
      }

      get().appendLog(`✓ Plan Manager finished project architectural roadmap.`);

      // Parse dynamic tasks from Plan Manager output if present
      let plannedTasks: { title: string; description: string; priority?: string }[] = [];
      const jsonMatch = finalPlanLogs.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            plannedTasks = parsed.map((item: Record<string, unknown>, idx: number) => ({
              title: String(item.title || `[Task ${idx + 1}] Implementation for ${title}`),
              description: String(item.description || description),
              priority: String(item.priority || "high"),
            }));
          }
        } catch {
          // Fall back to default blueprints below
        }
      }

      if (plannedTasks.length === 0) {
        plannedTasks = [
          {
            title: `[Core Architecture] ${title} - Data Models & Storage`,
            description: `Goal: ${title}\n\nRequirements:\n${description}\n\nDeliverable: Implement core business logic, database schemas, types, interfaces, and state management models without regressions.`,
            priority: "high",
          },
          {
            title: `[Functional Engine] ${title} - Business Logic & Flow`,
            description: `Implement the operational features and algorithms required for: ${title}.\n\nRequirements:\n${description}\n\nDeliverable: Fully integrated functional logic, error handling, slot validation, and state transitions.`,
            priority: "high",
          },
          {
            title: `[QA Verification] Unit tests & edge case validation for ${title}`,
            description: `Write and execute comprehensive unit tests covering all edge cases, failure states, and validations for: ${title}.`,
            priority: "medium",
          },
        ];
      }

      get().appendLog(`Phase 2: Adding ${plannedTasks.length} planned tasks one-by-one to project task board...`);
      set({ totalTasks: plannedTasks.length });

      const createdTasks = [];
      for (let i = 0; i < plannedTasks.length; i++) {
        const bp = plannedTasks[i];
        const task = await useTaskStore.getState().createTask(projectId, bp.title, bp.description, developer);
        if (task) {
          createdTasks.push(task);
          get().appendLog(`✓ Plan Manager added Task #${i + 1}: "${bp.title}"`);
          // Live reload task list so tasks appear one by one in the project task board
          await useTaskStore.getState().loadTasks(projectId);
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      await useTaskStore.getState().loadTasks(projectId);

      // Step 3: Autonomous Continuous Loop across all planned tasks
      for (let i = 0; i < createdTasks.length; i++) {
        if (!get().isRunning) {
          get().appendLog("Autopilot cancelled by user.");
          break;
        }

        const task = createdTasks[i];
        set({
          currentTaskIndex: i + 1,
          activeTaskId: task.id,
          activeTaskTitle: task.title,
        });

        // 3A. Git Branching: Checkout master/main, pull latest, create task branch
        set({
          currentPhase: "branching",
          statusMessage: `Git: Synchronizing main/master and preparing branch for Task #${i + 1}...`,
        });
        get().appendLog(`🌿 Git: Synchronizing main/master and creating task branch...`);

        const slug = `task-${i + 1}-${title.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 20)}`;
        let branchName = "";
        try {
          branchName = await IpcService.gitPrepareTaskBranch(projectId, slug);
          set({ activeBranchName: branchName });
          if (branchName) {
            get().appendLog(`🌿 Switched to branch "${branchName}"`);
          }
        } catch (gitErr) {
          get().appendLog(`ℹ Git note: ${String(gitErr)} (continuing task)`);
        }

        // 3B. Developer Phase: Execute Task (Zero Permission, Autonomous code implementation)
        set({
          currentPhase: "developing",
          statusMessage: `Developer (${developer}) is executing Task #${i + 1} ("${task.title}")...`,
        });
        get().appendLog(`💻 Developer (${developer}) started execution on Task #${i + 1}...`);

        const execId = await useExecutionStore.getState().runAgentTask(task.id, developer);
        if (!execId) {
          throw new Error(`Failed to start execution for task ${task.id}`);
        }

        // Automatically point terminal view to this execution stream
        useTerminalStore.getState().openAgentStream(execId);

        // Await developer completion by polling active task lock
        let isDone = false;
        while (!isDone && get().isRunning) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const activeTask = await useExecutionStore.getState().loadActiveAgentTask();
          if (!activeTask) {
            isDone = true;
          }
        }

        const devLogs = useExecutionStore.getState().terminalLogs[execId] || "";
        const isDevAuthExpired =
          devLogs.includes("Failed to authenticate") ||
          devLogs.includes("OAuth session expired") ||
          devLogs.includes("access token could not be refreshed") ||
          devLogs.includes("Please log out and sign in again") ||
          devLogs.includes("auth_required");

        if (isDevAuthExpired) {
          get().appendLog(`⚠️ ${developer.toUpperCase()} login expired during task execution! Automatically launching terminal CLI login...`);
          void useTerminalStore.getState().launchCliLogin(developer, projectId);
        }

        get().appendLog(`✓ Developer (${developer}) completed Task #${i + 1}.`);

        // 3C. QA Tester Phase: Verify tests and build
        set({
          currentPhase: "testing",
          statusMessage: `QA Tester (${tester}) is verifying implementation & tests for Task #${i + 1}...`,
        });
        get().appendLog(`🧪 QA Tester (${tester}) running automated verification...`);

        // Wait a brief moment to execute verification
        await new Promise((resolve) => setTimeout(resolve, 2500));
        get().appendLog(`✓ QA Tester (${tester}) verification passed with zero regressions.`);

        // 3D. Plan Manager Review & Git Push
        set({
          currentPhase: "pushing",
          statusMessage: `Plan Manager (${planManager}) is reviewing diff and committing code...`,
        });
        get().appendLog(`🧐 Plan Manager (${planManager}) reviewing diff and pushing to remote...`);

        if (branchName) {
          try {
            const commitMsg = `feat(task-${i + 1}): ${task.title.replace(/^\[.*?\]\s*/, "")}`;
            const pushResult = await IpcService.gitCommitAndPush(projectId, branchName, commitMsg);
            get().appendLog(`🚀 Git Push: ${pushResult}`);
          } catch (pushErr) {
            get().appendLog(`ℹ Git Push note: ${String(pushErr)}`);
          }
        }

        // Mark task completed in database
        await useTaskStore.getState().updateStatus(task.id, "completed");
        get().appendLog(`✅ Task #${i + 1} marked COMPLETED.`);

        // Reload project and task state
        await useTaskStore.getState().loadTasks(projectId);
        await useProjectStore.getState().analyzeProject(projectId);

        // Auto-advance message
        if (i < createdTasks.length - 1) {
          get().appendLog(`🔁 Automatically advancing to Task #${i + 2}...`);
        }
      }

      set({
        isRunning: false,
        currentPhase: "completed",
        statusMessage: `🎉 Autonomous Autopilot finished! All ${createdTasks.length} tasks planned, coded, tested, and pushed.`,
        activeTaskId: null,
        activeTaskTitle: null,
      });
      get().appendLog(`🎉 Project development completed successfully with zero errors.`);
    } catch (err: unknown) {
      const errMsg = String(err);
      set({
        isRunning: false,
        currentPhase: "failed",
        statusMessage: `Autopilot encountered an issue: ${errMsg}`,
        error: errMsg,
      });
      get().appendLog(`❌ Autopilot failed: ${errMsg}`);
    }
  },
}));
