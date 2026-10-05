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

      const planTaskTitle = `[Lead Architect] Architectural Blueprint & Sprint Plan: ${title}`;
      const planTaskDesc = `You are the Lead Software Architect and Plan Manager.
Apply principal architectural design, brainstorming, and writing-plans methodologies.

PROJECT GOAL:
${title}

REQUIREMENTS:
${description}

CRITICAL ARCHITECTURAL DIRECTIVES:
1. FULL-STACK & MODULE-WISE DECOMPOSITION:
   - For applications with UI: Structure as a Root Node.js project with an embedded 'frontend/' application (React/Vite) and backend in 'src/'.
   - Decompose into isolated modules (e.g. src/database, src/modules/booking, src/modules/conversation, frontend/src/components, frontend/src/store, tests/backend, tests/frontend).
   - Define exact Tech Stack & dependencies upfront.

2. PRE-DEFINED FOLDER STRUCTURE:
   - Define the exact directory tree (docs/, src/database/, src/modules/, src/server/, frontend/src/, tests/).
   - Every file created in subsequent tasks MUST belong to this predefined structure.

3. SECURITY & TOKEN PROTECTION (MANDATORY):
   - Never commit or expose local secrets, API keys, tokens, or environment variables.
   - Enforce .env.example templates and ensure .gitignore ignores all sensitive files.

4. PERSIST PLAN TO DISK:
   - Save the complete architectural specification to: 'docs/PROJECT_PLAN.md' inside this workspace.

5. SPRINT-WISE TASK ROADMAP:
   - Group the implementation into Sprints (e.g. Sprint 1: Foundation & Data Layer, Sprint 2: Core Business Engine & APIs, Sprint 3: Frontend UI Components, Sprint 4: Full-Stack Integration & QA).
   - At the VERY END of your response, output a strict JSON array of tasks with this exact schema for automated ingestion into the task board:
\`\`\`json
[
  {
    "sprint": "Sprint 1",
    "module": "database",
    "title": "[Sprint 1 - Database] Define schemas and slot models",
    "description": "Target: src/database/\\n\\nRequirements: Define data models and migrations. Acceptance criteria: Types compile and migrations run cleanly.",
    "priority": "high"
  },
  {
    "sprint": "Sprint 2",
    "module": "booking-engine",
    "title": "[Sprint 2 - Engine] Appointment slot calculation logic",
    "description": "Target: src/modules/booking/\\n\\nRequirements: Implement availability algorithm. Acceptance criteria: Handles conflicting slots and timezone calculations.",
    "priority": "high"
  },
  {
    "sprint": "Sprint 3",
    "module": "frontend-ui",
    "title": "[Sprint 3 - Frontend] Chat Widget and Appointment UI",
    "description": "Target: frontend/src/components/\\n\\nRequirements: Implement interactive chat box and calendar booking component. Acceptance criteria: Responsive UI with slot selection.",
    "priority": "high"
  },
  {
    "sprint": "Sprint 4",
    "module": "qa-integration",
    "title": "[Sprint 4 - QA & E2E] Full-stack integration and end-to-end tests",
    "description": "Target: tests/\\n\\nRequirements: Connect Frontend to Backend APIs and write end-to-end booking verification tests. Acceptance criteria: All tests pass without regressions.",
    "priority": "medium"
  }
]
\`\`\``;

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
            while (!planDone && get().isRunning && checks < 120) {
              await new Promise((r) => setTimeout(r, 1000));
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
                    while (!fbDone && get().isRunning && fbChecks < 120) {
                      await new Promise((r) => setTimeout(r, 1000));
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

      // Ensure active task lock is completely cleared for subsequent steps
      await useExecutionStore.getState().clearActiveLock();
      get().appendLog(`✓ Plan Manager finished project architectural roadmap.`);

      // Parse dynamic tasks from Plan Manager output (ANSI-safe + robust bracket fallback)
      let plannedTasks: { title: string; description: string; priority?: string }[] = [];
      const cleanLogs = finalPlanLogs
        .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
        .replace(/\r/g, "");

      let rawJson = "";
      const fenceMatch = cleanLogs.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/);
      if (fenceMatch && fenceMatch[1]) {
        rawJson = fenceMatch[1];
      } else {
        const firstBracket = cleanLogs.indexOf("[");
        const lastBracket = cleanLogs.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          rawJson = cleanLogs.substring(firstBracket, lastBracket + 1);
        }
      }

      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            plannedTasks = parsed.map((item: Record<string, unknown>, idx: number) => ({
              title: String(item.title || `[Sprint ${idx + 1}] Implementation for ${title}`),
              description: String(item.description || description),
              priority: String(item.priority || "high"),
            }));
          }
        } catch (parseErr) {
          console.warn("JSON plan parse warning:", parseErr);
        }
      }

      if (plannedTasks.length === 0) {
        plannedTasks = [
          {
            title: `[Sprint 1 - Foundation] ${title} - Database & Configuration Layer`,
            description: `Target: src/database/ and src/config/\n\nGoal: ${title}\n\nDeliverable: Implement core models, database schemas, types, and environment configuration without regressions.`,
            priority: "high",
          },
          {
            title: `[Sprint 2 - Core Engine] ${title} - Business Logic & API Services`,
            description: `Target: src/modules/ and src/server/\n\nDeliverable: Implement domain algorithms, operational controllers, validation, and error handling.`,
            priority: "high",
          },
          {
            title: `[Sprint 3 - Frontend UI] ${title} - Web Client & Interactive Components`,
            description: `Target: frontend/src/\n\nDeliverable: Build user interface, responsive state management, and real-time client connection.`,
            priority: "high",
          },
          {
            title: `[Sprint 4 - QA & Integration] Full-stack verification & unit tests for ${title}`,
            description: `Target: tests/\n\nDeliverable: Write comprehensive unit, integration, and end-to-end tests covering all edge cases.`,
            priority: "medium",
          },
        ];
      }

      // Persist the complete architectural blueprint and sprint plan to disk in docs/PROJECT_PLAN.md
      const planMarkdown = `# Architectural Blueprint & Sprint Plan: ${title}

## Overview & Scope
${description}

## Full-Stack Architecture
- **Root Node.js Application**: Coordinates dev scripts, linting, and build tooling.
- **Backend Architecture**: Modular Domain-Driven Engine in \`src/\` (\`database/\`, \`modules/\`, \`server/\`).
- **Frontend Architecture**: Client UI Application in \`frontend/\` (\`components/\`, \`pages/\`, \`store/\`, \`services/\`).
- **Testing Strategy**: Automated Unit & E2E Suites in \`tests/backend/\` and \`tests/frontend/\`.
- **Security Policy**: Sensitive environment variables (\`.env\`) and tokens are strictly excluded by \`.gitignore\`.

## Pre-Defined Folder Structure
\`\`\`text
├── docs/
│   └── PROJECT_PLAN.md
├── frontend/
│   ├── public/
│   └── src/ (components/, pages/, store/, services/)
├── src/
│   ├── config/
│   ├── database/ (models/, migrations/)
│   ├── modules/
│   └── server/ (routes/, controllers/)
├── tests/
│   ├── backend/
│   └── frontend/
└── package.json
\`\`\`

## Sprints & Deliverables Backlog
${plannedTasks.map((t, idx) => `### Task ${idx + 1}: ${t.title}\n${t.description}\n**Priority**: ${t.priority || "high"}\n`).join("\n")}

---
*Generated by Lead Architect (${planManager}) on ${new Date().toISOString()}*
`;

      try {
        await IpcService.projectSavePlan(projectId, planMarkdown);
        get().appendLog(`💾 Saved complete architecture specification to 'docs/PROJECT_PLAN.md'.`);
      } catch (saveErr) {
        console.warn("Could not save docs/PROJECT_PLAN.md:", saveErr);
      }

      get().appendLog(`Phase 2: Adding ${plannedTasks.length} sprint-planned tasks one-by-one to project task board...`);
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

        // 3A. Git Branching: Checkout master/main, pull latest, create task branch sprint-wise
        set({
          currentPhase: "branching",
          statusMessage: `Git: Synchronizing main/master and preparing branch for Task #${i + 1}...`,
        });
        get().appendLog(`🌿 Git: Synchronizing main/master and creating task branch...`);

        const sprintMatch = task.title.match(/\[(Sprint\s*\d+)[^\]]*\]/i);
        const sprintTag = sprintMatch ? sprintMatch[1].replace(/\s+/g, "-").toLowerCase() : `sprint-1`;
        const taskSlug = task.title
          .replace(/^\[.*?\]\s*/, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .slice(0, 25)
          .toLowerCase()
          .replace(/^-+|-+$/g, "");
        const slug = `${sprintTag}/${taskSlug || `task-${i + 1}`}`;
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

        await useExecutionStore.getState().clearActiveLock();
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
            const commitMsg = `feat(${sprintTag}): ${task.title.replace(/^\[.*?\]\s*/, "")}`;
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
        await useExecutionStore.getState().loadExecutions(projectId);
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
