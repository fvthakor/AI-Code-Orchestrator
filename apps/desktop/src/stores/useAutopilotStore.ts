import { create } from "zustand";
import type { Task } from "@ai-orchestrator/shared-types";
import { IpcService } from "../services/ipc";
import { useTaskStore } from "./useTaskStore";
import { useExecutionStore } from "./useExecutionStore";
import { useTeamStore } from "./useTeamStore";
import { useProjectStore } from "./useProjectStore";
import { useTerminalStore } from "./useTerminalStore";
import { useAgentStore } from "./useAgentStore";
import { parseQaVerdict } from "../services/qaVerdict";

/**
 * How many developer-fix cycles a task gets before the run pauses and asks you.
 * High enough that a task normally passes on its own; low enough that a broken task cannot loop forever.
 */
const MAX_QA_RETRIES = 10;

/**
 * Saved checkpoint of a run. "running" means the run was active (an app close or laptop sleep
 * leaves it that way, so it resumes on the next launch). "paused" was set by the user and never auto-resumes.
 */
export interface AutopilotCheckpoint {
  status: "running" | "paused" | "failed" | "done";
  projectId: string;
  title: string;
  description: string;
  planManager: string;
  developer: string;
  tester: string;
  taskIds: string[];
  currentIndex: number;
  branchName: string;
  /** Set by "Send to QA": this task's developer work is already done, so the run goes straight to QA */
  skipDeveloperTaskId?: string;
}

/** Last checkpoint written by this session. Used to update the status without losing the rest. */
let lastCheckpoint: AutopilotCheckpoint | null = null;

/** Whether the current run's repo has a remote. With a remote, delivery is a PR and a merge wait.
 *  Without one, a passed QA merges into master locally and the next task starts at once. */
let runHasRemote = false;

/** Projects whose restore is in progress, so a double call cannot start the same run twice. */
const restoringProjects = new Set<string>();

/** Updates only the status of the current checkpoint, reading it at call time (it may have changed). */
async function setCheckpointStatus(status: AutopilotCheckpoint["status"]): Promise<void> {
  const cp = lastCheckpoint;
  if (cp) await persistCheckpoint({ ...cp, status });
}

async function persistCheckpoint(cp: AutopilotCheckpoint): Promise<void> {
  lastCheckpoint = cp;
  try {
    await IpcService.autopilotSaveState(cp.projectId, JSON.stringify(cp));
  } catch (err) {
    console.warn("Could not save autopilot checkpoint:", err);
  }
}

async function loadCheckpoint(projectId: string): Promise<AutopilotCheckpoint | null> {
  try {
    const raw = await IpcService.autopilotLoadState(projectId);
    return raw ? (JSON.parse(raw) as AutopilotCheckpoint) : null;
  } catch {
    return null;
  }
}

/** Runs an agent on a task and waits until its lock clears. Returns the execution's log output. */
async function runAgentAndWait(projectId: string, taskId: string, agentId: string): Promise<string> {
  const execId = await useExecutionStore.getState().runAgentTask(taskId, agentId);
  if (!execId) {
    throw new Error(`Failed to start ${agentId} for task ${taskId}`);
  }

  await useTaskStore.getState().loadTasks(projectId);
  await useExecutionStore.getState().loadExecutions(projectId);
  useTerminalStore.getState().openAgentStream(execId);

  await waitForAgentExit(projectId, execId, `${agentId} on task`);

  return useExecutionStore.getState().terminalLogs[execId] || "";
}

/**
 * Marks a helper task (planner, QA, fix, resume) completed once its latest run is recorded as ended.
 * The run monitor writes its own status a few seconds after the agent exits, so waiting here
 * stops the monitor from overwriting this with "awaiting QA".
 */
async function completeTaskWhenRunSettled(projectId: string, taskId: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await useExecutionStore.getState().loadExecutions(projectId);
    const latest = useExecutionStore
      .getState()
      .executions.filter((e) => e.taskId === taskId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!latest || latest.status !== "running") break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await useTaskStore.getState().updateStatus(taskId, "completed");
}

/** An agent that prints nothing for this long is treated as stuck. */
const AGENT_IDLE_LIMIT_MS = 10 * 60 * 1000;
/** An agent sitting at an input prompt for this long is stuck (its task never arrived). */
const AGENT_PROMPT_WAIT_MS = 2 * 60 * 1000;
/** Automatic restarts of a stuck step before the run stops and asks for you. */
const MAX_STUCK_RETRIES = 2;

/** One line in the task timeline: a single sentence about what happened. */
export interface TimelineEvent {
  time: string;
  text: string;
  /** The task the event belongs to, so the task detail view can show only its events */
  taskId?: string;
}

/** Output an agent prints when it started but never received its task. */
const IDLE_PROMPT_PATTERNS = [/what'?s the task\?/i, /what would you like/i, /enter (a|your) task/i];

/** Thrown when an agent was stopped for being stuck. Retried automatically; anything else fails the run. */
export class AgentStuckError extends Error {}

/**
 * Waits until the agent process exits. The process itself is the signal, not the lock.
 * Stuck when it sits at an input prompt for 2 minutes, or prints nothing for 10 minutes.
 * A stuck agent is stopped and AgentStuckError is thrown.
 */
async function waitForAgentExit(projectId: string, execId: string, label: string): Promise<void> {
  let lastLength = -1;
  let lastOutputAt = Date.now();
  while (useAutopilotStore.getState().isRunning) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const log = useExecutionStore.getState().terminalLogs[execId] || "";
    if (log.length !== lastLength) {
      lastLength = log.length;
      lastOutputAt = Date.now();
    }

    if (!(await IpcService.executionIsRunning(execId))) {
      return;
    }

    await useTaskStore.getState().loadTasks(projectId);
    await useExecutionStore.getState().loadExecutions(projectId);

    const sinceOutput = Date.now() - lastOutputAt;
    const tail = log.slice(-400).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
    const atInputPrompt = IDLE_PROMPT_PATTERNS.some((p) => p.test(tail));

    let reason: string | null = null;
    if (atInputPrompt && sinceOutput > AGENT_PROMPT_WAIT_MS) {
      reason = "waiting at an input prompt, the task never arrived";
    } else if (sinceOutput > AGENT_IDLE_LIMIT_MS) {
      reason = `no output for ${AGENT_IDLE_LIMIT_MS / 60000} minutes`;
    }
    if (reason) {
      await IpcService.executionStop(execId).catch(() => undefined);
      throw new AgentStuckError(`${label} is stuck: ${reason}`);
    }
  }
}

/**
 * Runs a step and restarts it automatically when the agent gets stuck, up to MAX_STUCK_RETRIES times.
 * Other errors are not retried. Each restart is reported through onRetry.
 */
async function withStuckRetry<T>(
  onRetry: (message: string) => void,
  step: (attempt: number) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await step(attempt);
    } catch (err) {
      if (!(err instanceof AgentStuckError) || attempt >= MAX_STUCK_RETRIES) {
        throw err;
      }
      onRetry(`${err.message}. Restarting automatically (attempt ${attempt + 2} of ${MAX_STUCK_RETRIES + 1}).`);
    }
  }
}

/** True when the branch already has changes the developer left behind (for example, after a stuck run). */
async function hasUncommittedWork(projectId: string): Promise<boolean> {
  try {
    const git = await IpcService.gitStatus(projectId);
    return !git.isClean;
  } catch {
    return false;
  }
}

/** Builds the QA agent's prompt: acceptance criteria, automatic check results, and the review rules. */
function buildQaPrompt(
  acceptanceCriteria: string,
  branchName: string,
  report: { checks: { name: string; passed: boolean; detail: string }[] }
): string {
  const checkLines = report.checks
    .map((c) => `- ${c.name}: ${c.passed ? "PASSED" : "FAILED"}`)
    .join("\n");
  return `You are the QA Tester. Verify the developer's work on branch "${branchName}". Do NOT modify, create, or commit any files.

ACCEPTANCE CRITERIA (from the task):
${acceptanceCriteria}

AUTOMATIC CHECKS (already run by the orchestrator):
${checkLines}

YOUR JOB:
1. Review the change: run "git diff master...${branchName}" and read the changed files.
2. Write a SCENARIO CHECKLIST before judging. Cover at least: each acceptance criterion; the happy path; invalid or empty input; missing or not-found records; error responses (wrong method, bad JSON, server error); repeated actions (double submit); and what the UI shows on each failure. Test every scenario, and mark each one PASSED or FAILED with evidence (file and line, command output, or response).
3. The "test:e2e" check above is the browser evidence: a failed e2e check means the UI or API flow is broken. Read its output and cite it. If the task includes an API that has no e2e coverage, start it briefly using .env.example, call each endpoint the criteria mention, record status and response, then stop every process you started before finishing.
4. Approve only if EVERY scenario in the checklist is PASSED with evidence. Otherwise reject and list each FAILED scenario concretely (what was expected, what happened), so the developer can fix exactly that.

FINISH with exactly one JSON line as the last line of your output, no other text after it. Use the verdict word "approve" or "reject" and put a short evidence string in reasons for each failure:
VERDICT_JSON: {"verdict": <approve or reject>, "reasons": [<strings>]}`;
}


export type AutopilotPhase =
  | "idle"
  | "planning"
  | "branching"
  | "developing"
  | "testing"
  | "pushing"
  | "waiting_for_merge"
  | "completed"
  | "failed"
  | "paused";

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
  skipCurrentMergeWait: boolean;
  pauseRequested: boolean;
  isPaused: boolean;
  /** True after a failed run that has a checkpoint: Resume continues it from that task */
  resumable: boolean;
  /** Set when the whole plan is finished (merged). Shown as a green banner until dismissed */
  successMessage: string | null;
  timeline: TimelineEvent[];
  addEvent: (text: string) => void;

  startAutopilot: (params: {
    projectId: string;
    title: string;
    description: string;
    isGreenfield?: boolean;
    resume?: AutopilotCheckpoint;
  }) => Promise<void>;
  stopAutopilot: () => void;
  dismissError: () => void;
  dismissSuccess: () => void;
  pauseAutopilot: () => Promise<void>;
  resumeAutopilot: (projectId: string) => Promise<void>;
  sendTaskToQa: (projectId: string, taskId: string) => Promise<void>;
  continuePlan: (projectId: string, sinceIso?: string) => Promise<void>;
  restoreAutopilot: (projectId: string) => Promise<void>;
  forceMergeAndContinue: () => void;
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
  skipCurrentMergeWait: false,
  pauseRequested: false,
  isPaused: false,
  resumable: false,
  successMessage: null,
  timeline: [],
  addEvent: (text: string) => {
    const event: TimelineEvent = {
      time: new Date().toLocaleTimeString(),
      text,
      taskId: get().activeTaskId ?? undefined,
    };
    set((state) => ({ timeline: [...state.timeline, event].slice(-200) }));
  },

  appendLog: (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    set((state) => ({ logs: [...state.logs.slice(-50), `[${timestamp}] ${msg}`] }));
  },

  forceMergeAndContinue: () => {
    set({ skipCurrentMergeWait: true });
    get().appendLog("User requested force merge & continue for current task branch.");
  },

  dismissSuccess: () => {
    set({ successMessage: null });
  },

  dismissError: () => {
    set({ error: null, resumable: false, currentPhase: "idle", statusMessage: "Standing by" });
  },

  // Stop and pause are the same action: the run stops, its agent is killed, and it can be resumed later
  stopAutopilot: () => {
    void get().pauseAutopilot();
  },

  pauseAutopilot: async () => {
    if (!get().isRunning) return;
    set({
      pauseRequested: true,
      isRunning: false,
      statusMessage: "Pausing: stopping the current agent...",
    });
    get().appendLog("⏸ Pause requested. Stopping the current agent; uncommitted work is kept and the task resumes on the same branch.");

    const execId = useExecutionStore.getState().activeExecutionId;
    if (execId) {
      try {
        await IpcService.executionStop(execId);
      } catch (err) {
        get().appendLog(`ℹ Could not stop agent cleanly: ${String(err)}`);
      }
    }
    // Checkpoint status flips to paused so the run never auto-resumes on launch
    await setCheckpointStatus("paused");
  },

  resumeAutopilot: async (projectId: string) => {
    if (get().isRunning) return;
    const cp = await loadCheckpoint(projectId);
    if (!cp || cp.status === "done") {
      set({ statusMessage: "Nothing to resume for this project." });
      return;
    }
    await useTaskStore.getState().loadTasks(projectId);
    set({ isPaused: false });
    get().appendLog(`▶ Resuming autopilot from Task #${cp.currentIndex + 1}.`);
    await get().startAutopilot({
      projectId: cp.projectId,
      title: cp.title,
      description: cp.description,
      resume: cp,
    });
  },

  /**
   * Starts the pending Sprint tasks of the current plan, in order, through the full cycle:
   * develop → QA → push → PR → merge wait → next. Starts from master, so it needs no manual step.
   * Does nothing while a run is active, or when no plan task is pending.
   */
  continuePlan: async (projectId: string, sinceIso?: string) => {
    if (get().isRunning) return;
    await useTaskStore.getState().loadTasks(projectId);

    const sprintNo = (title: string) => Number(title.match(/\[Sprint\s*(\d+)/i)?.[1] ?? 999);
    const pending = useTaskStore
      .getState()
      .tasks.filter(
        (t) =>
          /^\[Sprint\s*\d+/i.test(t.title) &&
          t.status === "pending" &&
          // On open, only tasks from the finished run's plan (created since its first task), never older leftovers
          (!sinceIso || t.createdAt >= sinceIso)
      )
      .sort((a, b) => sprintNo(a.title) - sprintNo(b.title) || a.createdAt.localeCompare(b.createdAt));

    if (pending.length === 0) {
      set({ statusMessage: "No pending plan tasks to continue." });
      return;
    }

    const first = pending[0];
    get().addEvent(`Continuing the plan: ${pending.length} pending task(s), starting with "${first.title}".`);
    await get().startAutopilot({
      projectId,
      title: first.title,
      description: first.description,
      resume: {
        status: "running",
        projectId,
        title: first.title,
        description: first.description,
        planManager: "",
        developer: "",
        tester: "",
        taskIds: pending.map((t) => t.id),
        currentIndex: 0,
        // Empty branch: the first task starts a fresh branch from master, including the merged work
        branchName: "",
      },
    });
  },

  /**
   * For a task the developer already finished (status awaiting_qa): runs QA, commit, and PR on its
   * existing branch. Does not start the other tasks, since the old pending tasks have not been decided.
   */
  sendTaskToQa: async (projectId: string, taskId: string) => {
    if (get().isRunning) return;
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const git = await IpcService.gitStatus(projectId);
    // The task's branch name is built from its title, so check the current branch belongs to this task
    const titleSlug = task.title
      .replace(/^\[.*?\]\s*/, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .toLowerCase()
      .slice(0, 15);
    if (!titleSlug || !git.branch.includes(titleSlug)) {
      set({
        error: `Checkout this task's branch first (currently on '${git.branch}').`,
        statusMessage: `Checkout this task's branch first (currently on '${git.branch}').`,
      });
      return;
    }

    // Read the board fresh, then build the remaining work from it: this task first, then the
    // pending Sprint tasks created with it, in sprint order. Helper tasks and older plans are left out.
    await useTaskStore.getState().loadTasks(projectId);
    const sprintNo = (title: string) => Number(title.match(/\[Sprint\s*(\d+)/i)?.[1] ?? 999);
    const planIds = useTaskStore
      .getState()
      .tasks.filter(
        (t) =>
          t.id === task.id ||
          (/^\[Sprint\s*\d+/i.test(t.title) && t.status === "pending" && t.createdAt >= task.createdAt)
      )
      .sort((a, b) => {
        if (a.id === task.id) return -1;
        if (b.id === task.id) return 1;
        return sprintNo(a.title) - sprintNo(b.title);
      })
      .map((t) => t.id);
    await get().startAutopilot({
      projectId,
      title: task.title,
      description: task.description,
      resume: {
        status: "running",
        projectId,
        title: task.title,
        description: task.description,
        planManager: "",
        developer: "",
        tester: "",
        taskIds: planIds,
        currentIndex: 0,
        branchName: git.branch,
        skipDeveloperTaskId: task.id,
      },
    });
  },

  // Called on launch: a run that was active when the app closed or the laptop slept resumes by itself.
  // A run the user paused stays paused and waits for the Resume button.
  restoreAutopilot: async (projectId: string) => {
    // Guard: React StrictMode and re-renders can call this twice for one launch
    if (get().isRunning || restoringProjects.has(projectId)) return;
    restoringProjects.add(projectId);
    try {
      const cp = await loadCheckpoint(projectId);
      if (!cp) return;
      if (cp.status === "paused") {
        set({
          isPaused: true,
          currentPhase: "paused",
          statusMessage: "Autopilot is paused. Press Resume to continue.",
        });
        return;
      }
      if (cp.status === "done") {
        // The last run finished, but plan tasks from that same plan may still be waiting
        // (a run that ended early). Continue them on open. Older leftovers are never started.
        await useTaskStore.getState().loadTasks(projectId);
        const firstOfPlan = useTaskStore.getState().tasks.find((t) => t.id === cp.taskIds[0]);
        if (firstOfPlan) {
          await get().continuePlan(projectId, firstOfPlan.createdAt);
        }
        return;
      }
      if (cp.status === "failed") {
        // A run that stopped with an error stays resumable across restarts, with a visible Resume
        set({
          resumable: true,
          currentPhase: "failed",
          error: "The last run stopped before it finished. Resume continues it from the same task.",
          statusMessage: "Last run stopped. Press Resume to continue.",
        });
        return;
      }
      if (cp.status === "running") {
        get().appendLog("🔄 Found an unfinished run (app closed or laptop slept). Resuming automatically.");
        await get().resumeAutopilot(projectId);
      }
    } finally {
      restoringProjects.delete(projectId);
    }
  },

  startAutopilot: async ({ projectId, title, description, isGreenfield: _isGreenfield = false, resume }) => {
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

    // A new run must not inherit the previous run's checkpoint (a pause would write it to the wrong project)
    lastCheckpoint = null;
    set({
      isRunning: true,
      isPaused: false,
      pauseRequested: false,
      resumable: false,
      currentPhase: resume ? "developing" : "planning",
      statusMessage: resume
        ? `Resuming autopilot at Task #${resume.currentIndex + 1}...`
        : `Plan Manager (${planManager}) is planning entire project architecture and task roadmap...`,
      error: null,
      logs: resume ? get().logs : [],
      timeline: resume ? get().timeline : [],
      currentTaskIndex: 0,
      totalTasks: 0,
    });
    // Keep the machine awake while the run is active (idle sleep only; see power_keep_awake)
    void IpcService.powerKeepAwake(true).catch(() => undefined);

    // Open terminal drawer and focus on agent execution stream
    useTerminalStore.getState().openAgentStream();

    if (!resume) {
      get().appendLog(`🚀 Starting Autonomous Autopilot on project.`);
      get().appendLog(`📋 Goal: ${title}`);
      get().appendLog(`👥 Assigned Team: Plan Manager (${planManager}), Developer (${developer}), QA Tester (${tester}).`);

      // Warn about missing tools before any agent runs, so a failure is explained, not mysterious
      try {
        const env = await IpcService.environmentCheck();
        for (const check of env.filter((c) => !c.ok)) {
          get().appendLog(`⚠ Environment: ${check.name} ${check.detail}`);
          get().addEvent(`Environment: ${check.name} ${check.detail}`);
        }
      } catch (envErr) {
        get().appendLog(`ℹ Environment check skipped: ${String(envErr)}`);
      }
    }

    try {
      // Git first: a repo needs a first commit on master before any task branch can be made.
      // Safe to run on resume too: it does nothing that is already in place.
      const repo = await IpcService.gitBootstrapRepo(projectId);
      runHasRemote = repo.hasRemote;
      get().appendLog(
        `🧱 Repo ready: base branch '${repo.baseBranch}'${repo.createdInitialCommit ? ", first commit created" : ""}${repo.hasRemote ? ", pushed to origin" : ", local only (no remote)"}.`
      );
      get().addEvent(
        `Repo ready on '${repo.baseBranch}'${repo.hasRemote ? " (remote)" : " (local only)"}.`
      );

      let createdTasks: Task[] = [];
      let startIndex = 0;
      if (resume) {
        // Resuming: reuse the tasks already on the board instead of planning again
        const boardTasks = useTaskStore.getState().tasks;
        createdTasks = resume.taskIds
          .map((id) => boardTasks.find((t) => t.id === id))
          .filter((t): t is Task => !!t);
        startIndex = resume.currentIndex;
      } else {
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

5. SELF-TERMINATING EXECUTION ONLY (CRITICAL):
   - Every task deliverable and verification MUST terminate cleanly on its own.
   - Developers NEVER leave HTTP listeners, dev servers, or daemon processes running when they finish.
   - QA may start the app only to verify it, and MUST stop every process it started before finishing.
   - All tests must be finite test suites (unit/integration tests) that automatically finish and exit.

6. SPRINT-WISE TASK ROADMAP:
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
            await useTaskStore.getState().loadTasks(projectId);
            await useExecutionStore.getState().loadExecutions(projectId);
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
              if (checks % 2 === 0) {
                await useTaskStore.getState().loadTasks(projectId);
                await useExecutionStore.getState().loadExecutions(projectId);
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
        await completeTaskWhenRunSettled(projectId, planTask.id);
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

      // Existing projects: close their gaps (env template, ports, e2e, run docs) before any feature work.
      // Greenfield projects have no package.json yet, so they get no Gap Fill task.
      try {
        const gapReport = await IpcService.qaGapReport(projectId);
        if (gapReport.hasPackageJson && gapReport.gaps.length > 0) {
          plannedTasks = [
            {
              title: "[Sprint 0 - Gap Fill] Close project gaps before feature work",
              description: `Target: project root (existing code)

Requirements: close these gaps without changing existing features:
${gapReport.gaps.map((g) => `- ${g}`).join("\n")}

Environment variables the code reads: ${gapReport.envVars.join(", ") || "none"}
Declared ports: ${gapReport.ports.join(", ") || "none"}

Acceptance criteria: every gap above is closed; the app starts from .env.example copied to .env; build, lint, and test pass.`,
              priority: "high",
            },
            ...plannedTasks,
          ];
          get().appendLog(`🧩 Found ${gapReport.gaps.length} project gap(s). Gap Fill task added first.`);
        }
      } catch (gapErr) {
        get().appendLog(`ℹ Gap check skipped: ${String(gapErr)}`);
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

      createdTasks = [];
      for (let i = 0; i < plannedTasks.length; i++) {
        const bp = plannedTasks[i];
        // Every task carries the same delivery contract, whatever the planner wrote
        const deliveryContract = `

DELIVERY CONTRACT (mandatory, QA rejects the task if any point is missing):
- Acceptance criteria above are the test: each one must be verifiable by running the app or its tests.
- .env.example at the project root lists every environment variable the code reads (process.env, import.meta.env, os.environ, and similar), each with a safe placeholder, a comment, and a default. Any *_PORT variables must have DIFFERENT values, and no port may be hard-coded.
- README.md has a "Run" section with the exact install, start, and test commands.
- Browser tests: tests/e2e/ holds Playwright tests, one per acceptance criterion that touches the UI or API. Install @playwright/test as a dev dependency. "npm run test:e2e" must start the app itself (Playwright webServer), run the tests, and exit.
- Commit nothing secret: .env stays in .gitignore.
- Leave no server or dev process running when you finish.`;
        const task = await useTaskStore
          .getState()
          .createTask(projectId, bp.title, `${bp.description}${deliveryContract}`, developer);
        if (task) {
          createdTasks.push(task);
          get().appendLog(`✓ Plan Manager added Task #${i + 1}: "${bp.title}"`);
          // Live reload task list so tasks appear one by one in the project task board
          await useTaskStore.getState().loadTasks(projectId);
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      await useTaskStore.getState().loadTasks(projectId);
      }

      // Checkpoint the plan: from here on, a restart resumes at the saved task instead of planning again
      await persistCheckpoint({
        status: "running",
        projectId,
        title,
        description,
        planManager,
        developer,
        tester,
        taskIds: createdTasks.map((t) => t.id),
        currentIndex: startIndex,
        branchName: "",
      });

      // Step 3: Autonomous Continuous Loop across all planned tasks
      for (let i = startIndex; i < createdTasks.length; i++) {
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
        // Checkpoint each task start, so a pause or restart knows exactly where to continue
        await persistCheckpoint({
          status: "running",
          projectId,
          title,
          description,
          planManager,
          developer,
          tester,
          taskIds: createdTasks.map((t) => t.id),
          currentIndex: i,
          branchName: "",
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
        // Resuming the interrupted task: switch to its branch as-is, so uncommitted work is kept
        const resumingHere = resume !== undefined && i === startIndex && resume.branchName !== "";
        const skipDeveloper = resumingHere && resume?.skipDeveloperTaskId === task.id;
        try {
          branchName = resumingHere
            ? await IpcService.gitResumeTaskBranch(projectId, resume?.branchName ?? "")
            : await IpcService.gitPrepareTaskBranch(projectId, slug);
          set({ activeBranchName: branchName });
          if (branchName) {
            get().appendLog(`🌿 Switched to branch "${branchName}"`);
            // Save the branch so a resume can switch back to it without resetting
            await persistCheckpoint({
              status: "running",
              projectId,
              title,
              description,
              planManager,
              developer,
              tester,
              taskIds: createdTasks.map((t) => t.id),
              currentIndex: i,
              branchName,
            });
          }
        } catch (gitErr) {
          // No branch means no push and no merge gate: stop instead of running unguarded
          throw new Error(`Git branch setup failed for Task #${i + 1}: ${String(gitErr)}`);
        }
        if (!branchName) {
          // Backend returns "" when the project is not a git repo: nothing can be pushed or gated
          throw new Error(`Project is not a git repository; cannot run Task #${i + 1} with the merge gate`);
        }

        // 3B. Developer Phase: Execute Task (Zero Permission, Autonomous code implementation)
        set({
          currentPhase: "developing",
          statusMessage: `Developer (${developer}) is executing Task #${i + 1} ("${task.title}")...`,
        });
        get().appendLog(`💻 Developer (${developer}) started execution on Task #${i + 1}...`);
        get().addEvent(`Task #${i + 1} · Developer is working on it.`);

        await useExecutionStore.getState().clearActiveLock();
        let devTaskId = task.id;
        if (resumingHere && !skipDeveloper) {
          // Tell the developer the working tree already has partial work from the interrupted run
          const resumeTask = await useTaskStore
            .getState()
            .createTask(
              projectId,
              `[Resume] ${task.title.replace(/^\[.*?\]\s*/, "")}`,
              `${task.description}\n\nRESUME NOTE: this task was interrupted (pause or laptop sleep). The working tree already has partial work on this branch. Run git status and git diff first, continue from there, and do not discard existing changes.`,
              developer
            );
          if (resumeTask) devTaskId = resumeTask.id;
        }
        // A stuck agent is stopped and this step restarts on its own (see withStuckRetry)
        const devResult = await withStuckRetry(
          (msg) => {
            get().appendLog(`🔁 ${msg}`);
            get().addEvent(`Task #${i + 1} · Stuck, restarting automatically.`);
          },
          async (attempt) => {
            // "Send to QA": the developer already finished this task, so only QA, commit, and PR remain
            if (skipDeveloper) {
              get().addEvent(`Task #${i + 1} · Developer work already finished, going straight to QA.`);
              return "skipped" as const;
            }
            if (attempt > 0) get().addEvent(`Task #${i + 1} · Developer restarted after getting stuck.`);
            // Restart after a stuck run: if changes already exist on the branch, go straight to QA
            if (attempt > 0 && (await hasUncommittedWork(projectId))) {
              get().appendLog(`↪ Changes already on the branch for Task #${i + 1}: skipping the developer, going to QA.`);
              return "skipped" as const;
            }

            const execId = await useExecutionStore.getState().runAgentTask(devTaskId, developer);
            if (!execId) {
              throw new Error(`Failed to start execution for task ${task.id}`);
            }

            // Live refresh so tasks and executions immediately show [running] badge in real time
            await useTaskStore.getState().loadTasks(projectId);
            await useExecutionStore.getState().loadExecutions(projectId);

            // Automatically point terminal view to this execution stream
            useTerminalStore.getState().openAgentStream(execId);

            await waitForAgentExit(projectId, execId, `Developer (${developer}) on Task #${i + 1}`);

            // Paused or stopped during the developer step: leave the task for the resume
            if (!get().isRunning) return "paused" as const;

            await useExecutionStore.getState().loadExecutions(projectId);
            const devExec = useExecutionStore.getState().executions.find((e) => e.id === execId);
            if (devExec?.status === "failed") {
              throw new Error(`Developer (${developer}) exited with an error on Task #${i + 1}. See its execution log.`);
            }

            const devLogs = useExecutionStore.getState().terminalLogs[execId] || "";
            if (!devLogs.trim()) {
              // An agent that exits without output did not run the task
              throw new Error(`Developer (${developer}) produced no output for Task #${i + 1}; the agent likely exited early`);
            }
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
            return "done" as const;
          }
        );
        if (devResult === "paused") break;
        // A helper task (resume note) is finished once its developer run is done
        if (devTaskId !== task.id) {
          await completeTaskWhenRunSettled(projectId, devTaskId);
        }

        get().appendLog(`✓ Developer (${developer}) completed Task #${i + 1}.`);
        get().addEvent(`Task #${i + 1} · Developer finished, running automatic checks.`);

        // 3C. QA loop: automatic checks, then QA agent verdict. Rejected work goes back to the developer.
        let approved = false;
        let feedback = "";
        for (let attempt = 0; attempt <= MAX_QA_RETRIES && !approved && get().isRunning; attempt++) {
          if (attempt > 0) {
            set({
              currentPhase: "developing",
              statusMessage: `Developer (${developer}) fixing Task #${i + 1} (fix ${attempt} of ${MAX_QA_RETRIES})...`,
            });
            get().appendLog(`🔁 QA rejected Task #${i + 1}. Sending feedback to ${developer} (fix ${attempt} of ${MAX_QA_RETRIES}).`);
            const fixTask = await useTaskStore
              .getState()
              .createTask(
                projectId,
                `[Fix ${attempt}] ${task.title.replace(/^\[.*?\]\s*/, "")}`,
                `${task.description}\n\nQA FEEDBACK (fix every point below, then stop):\n${feedback}`,
                developer
              );
            if (!fixTask) {
              throw new Error(`Could not create fix task for Task #${i + 1}`);
            }
            // Fix cycles get the same automatic restart as the first developer run
            await withStuckRetry(
              (msg) => {
                get().appendLog(`🔁 ${msg}`);
                get().addEvent(`Task #${i + 1} · Fix developer stuck, restarting automatically.`);
              },
              () => runAgentAndWait(projectId, fixTask.id, developer)
            );
            await completeTaskWhenRunSettled(projectId, fixTask.id);
          }

          // 3C-1. Automatic checks: env template, port clashes, install, build, lint, test
          set({
            currentPhase: "testing",
            statusMessage: `Automatic QA checks for Task #${i + 1}...`,
          });
          get().appendLog(`🧪 Automatic QA checks running on Task #${i + 1}...`);
          const report = await IpcService.qaStaticChecks(projectId);
          const failedChecks = report.checks.filter((c) => !c.passed);
          for (const c of report.checks) {
            get().appendLog(`${c.passed ? "✓" : "✗"} ${c.name}: ${c.passed ? "ok" : c.detail.split("\n")[0]}`);
          }
          if (failedChecks.length > 0) {
            feedback = `Automatic checks failed:\n${failedChecks.map((c) => `- ${c.name}: ${c.detail}`).join("\n")}`;
            get().appendLog(`❌ Automatic QA failed: ${failedChecks.map((c) => c.name).join(", ")}`);
            continue;
          }

          // 3C-2. QA agent verdict: judges acceptance criteria against the diff and check results
          set({
            currentPhase: "testing",
            statusMessage: `QA Tester (${tester}) reviewing Task #${i + 1} against acceptance criteria...`,
          });
          get().appendLog(`🧪 QA Tester (${tester}) reviewing Task #${i + 1}...`);
          const qaTask = await useTaskStore
            .getState()
            .createTask(projectId, `[QA] Verify: ${task.title.replace(/^\[.*?\]\s*/, "")}`, buildQaPrompt(task.description, branchName, report), tester);
          if (!qaTask) {
            throw new Error(`Could not create QA task for Task #${i + 1}`);
          }
          get().addEvent(`Task #${i + 1} · QA is checking the acceptance criteria.`);
          const qaLogs = await withStuckRetry(
            (msg) => {
              get().appendLog(`🔁 ${msg}`);
              get().addEvent(`Task #${i + 1} · QA stuck, restarting automatically.`);
            },
            () => runAgentAndWait(projectId, qaTask.id, tester)
          );
          const verdict = parseQaVerdict(qaLogs);
          // The QA run itself is finished once it has a verdict; its status must not stay "awaiting QA"
          await completeTaskWhenRunSettled(projectId, qaTask.id);
          if (verdict.approved) {
            approved = true;
            get().appendLog(`✅ QA approved Task #${i + 1}.`);
            get().addEvent(`Task #${i + 1} · QA approved.`);
          } else {
            feedback = `QA agent rejected the work:\n${verdict.reasons.map((r) => `- ${r}`).join("\n") || "- no verdict produced"}`;
            get().appendLog(`❌ QA rejected Task #${i + 1}: ${verdict.reasons[0] || "no verdict produced"}`);
            get().addEvent(`Task #${i + 1} · QA rejected: ${(verdict.reasons[0] || "no verdict produced").slice(0, 140)}`);
          }
        }

        if (!approved) {
          if (!get().isRunning) break;
          // Cap reached: pause for you rather than failing the run, so no work is lost
          const lastReason = feedback.split("\n").find((l) => l.startsWith("- ")) ?? feedback.split("\n")[0];
          await setCheckpointStatus("paused");
          get().addEvent(`Task #${i + 1} · Needs you: still failing QA after ${MAX_QA_RETRIES} fix cycles. ${lastReason.slice(0, 120)}`);
          get().appendLog(`⏸ Task #${i + 1} still fails QA after ${MAX_QA_RETRIES} fix cycles. Paused for you. Last feedback: ${feedback}`);
          void IpcService.powerKeepAwake(false).catch(() => undefined);
          set({
            isRunning: false,
            isPaused: true,
            pauseRequested: false,
            currentPhase: "paused",
            statusMessage: `Needs you: Task #${i + 1} still fails QA after ${MAX_QA_RETRIES} fix cycles. Fix it or change the task, then Resume.`,
          });
          return;
        }

        // Paused before commit: nothing is pushed or merged; the task resumes from the QA step
        if (!get().isRunning) break;

        // 3D. Commit, push, and auto-merge the approved work into master
        set({
          currentPhase: "pushing",
          statusMessage: `Committing, pushing, and merging approved Task #${i + 1}...`,
        });
        const commitMsg = `feat(${sprintTag}): ${task.title.replace(/^\[.*?\]\s*/, "")}`;
        const pushResult = await IpcService.gitCommitAndPush(projectId, branchName, commitMsg);
        get().appendLog(`🚀 Git Push: ${pushResult}`);

        if (!runHasRemote) {
          // Local-only: no PR and no remote to wait on. QA has passed, so merge into master now.
          const localMerge = await IpcService.gitMergeBranchLocally(projectId, branchName);
          get().appendLog(`🌿 Merged locally: ${localMerge}`);
          get().addEvent(`Task #${i + 1} · Merged into master locally, starting the next task.`);
        } else try {
          // Open a PR for review. The merge gate below waits until it is merged into master.
          // Nothing is merged here, so a bad approval never reaches master by itself.
          const pr = await IpcService.gitCreatePr({
            projectId,
            branchName,
            title: commitMsg,
            body: `Automatic QA approved Task #${i + 1}: ${task.title.replace(/^\[.*?\]\s*/, "")}\n\nBranch: ${branchName}`,
          });
          get().appendLog(`🔀 Pull request opened: ${pr.prUrl}. Merge it into master to continue.`);
          get().addEvent(`Task #${i + 1} · Pull request opened, waiting for merge into master.`);
        } catch (prErr) {
          // Without a PR the branch is still pushed; the gate keeps waiting for a manual merge
          get().appendLog(`ℹ Could not open a PR automatically (${String(prErr)}). Merge branch '${branchName}' into master manually to continue.`);
        }

        // With a remote, a pushed PR is not finished work: the task waits for its merge.
        // Without one, the local merge above already finished it.
        await useTaskStore.getState().updateStatus(task.id, runHasRemote ? "awaiting_merge" : "completed");
        get().appendLog(
          runHasRemote
            ? `⏳ Task #${i + 1} is waiting for its PR to be merged.`
            : `✅ Task #${i + 1} marked COMPLETED.`
        );

        // Reload project and task state
        await useTaskStore.getState().loadTasks(projectId);
        await useExecutionStore.getState().loadExecutions(projectId);
        await useProjectStore.getState().analyzeProject(projectId);

        // 3E. Git Merge Gate: Verify previous task branch is merged into master/main before starting next task
        // Every task with a remote waits for its PR to be merged, the last one included.
        // Local-only runs already merged in the delivery step.
        if (runHasRemote && branchName) {
          set({
            currentPhase: "waiting_for_merge",
            statusMessage: `Task #${i + 1} is waiting for its PR to be merged into master. Merge it on GitHub; checking every 30s.`,
          });
          get().addEvent(`Task #${i + 1} · PR open, waiting for merge into master (checking every 30s).`);
          get().appendLog(`⏳ Git Gate: Next task held. Waiting for branch '${branchName}' to be merged into master/main before starting Task #${i + 2}...`);

          let isMerged = false;
          let checkCount = 0;

          while (!isMerged && get().isRunning) {
            try {
              isMerged = await IpcService.gitIsBranchMerged(projectId, branchName);
            } catch (mergeErr) {
              console.warn("Could not check merge status:", mergeErr);
              isMerged = false;
            }

            if (isMerged) {
              get().appendLog(`🎉 Branch '${branchName}' has been merged into master/main! Pulling latest changes...`);
              await useTaskStore.getState().updateStatus(task.id, "completed");
              get().addEvent(
                i < createdTasks.length - 1
                  ? `Task #${i + 1} · Merged into master. Starting the next task.`
                  : `Task #${i + 1} · Merged into master. That was the last task.`
              );
              break;
            }

            checkCount++;
            get().appendLog(`⏳ Branch '${branchName}' not merged yet (check #${checkCount}). Re-checking in 30 seconds... (Please merge PR on GitHub/Git)`);

            // 30-second interval with 1-second ticks for instant cancellation or manual force-merge
            for (let sec = 0; sec < 30 && get().isRunning; sec++) {
              if (get().skipCurrentMergeWait) {
                get().appendLog(`⏩ Merge wait bypassed by user! Merging branch locally...`);
                try {
                  const mergeResult = await IpcService.gitMergeBranchLocally(projectId, branchName);
                  get().appendLog(`🌿 Local merge: ${mergeResult}`);
                } catch (mErr) {
                  get().appendLog(`ℹ Local merge note: ${String(mErr)}`);
                }
                isMerged = true;
                set({ skipCurrentMergeWait: false });
                break;
              }
              await new Promise((r) => setTimeout(r, 1000));
            }
          }

          if (!get().isRunning) {
            get().appendLog("Autopilot stopped while waiting for branch merge.");
            break;
          }

          if (i < createdTasks.length - 1) {
            get().appendLog(`🔁 Advancing to Task #${i + 2}...`);
          }
        }
      }

      if (get().pauseRequested) {
        // Paused: the checkpoint is already saved, so Resume continues from the same task
        void IpcService.powerKeepAwake(false).catch(() => undefined);
        await setCheckpointStatus("paused");
        set({
          isRunning: false,
          isPaused: true,
          pauseRequested: false,
          currentPhase: "paused",
          statusMessage: "Autopilot is paused. Press Resume to continue where it stopped.",
        });
        get().appendLog("⏸ Autopilot paused.");
        return;
      }

      await setCheckpointStatus("done");
      void IpcService.powerKeepAwake(false).catch(() => undefined);
      set({
        isRunning: false,
        currentPhase: "completed",
        statusMessage: runHasRemote
          ? `🎉 All ${createdTasks.length} tasks are merged into master. The plan is complete.`
          : `🎉 All ${createdTasks.length} tasks are done and merged locally. The plan is complete.`,
        successMessage: runHasRemote
          ? `All ${createdTasks.length} tasks are done and merged into master.`
          : `All ${createdTasks.length} tasks are done and merged locally.`,
        activeTaskId: null,
        activeTaskTitle: null,
      });
      get().appendLog(`🎉 Project development completed successfully with zero errors.`);
      get().addEvent(`All ${createdTasks.length} task(s) finished. Pull requests are open for merge into master.`);
    } catch (err: unknown) {
      const errMsg = String(err);
      void IpcService.powerKeepAwake(false).catch(() => undefined);
      // A failure stops the run without auto-resume; a pause that caused the error stays paused
      await setCheckpointStatus(get().pauseRequested ? "paused" : "failed");
      set({
        isRunning: false,
        currentPhase: "failed",
        resumable: true,
        statusMessage: `Autopilot encountered an issue: ${errMsg}`,
        error: errMsg,
      });
      get().appendLog(`❌ Autopilot failed: ${errMsg}`);
      get().addEvent(`Stopped: ${errMsg.split("\n")[0].slice(0, 160)}`);
    }
  },
}));
