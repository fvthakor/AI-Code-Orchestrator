import { useEffect, useState } from "react";
import {
  FolderOpen,
  GitBranch,
  Play,
  Terminal,
  RefreshCw,
  PlusCircle,
  Clock,
  ShieldCheck,
  Layers,
  Users,
  GitPullRequest,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useProjectStore } from "../stores/useProjectStore";
import { useAgentStore } from "../stores/useAgentStore";
import { useTaskStore } from "../stores/useTaskStore";
import { useExecutionStore } from "../stores/useExecutionStore";
import { useTerminalStore } from "../stores/useTerminalStore";
import { useTeamStore } from "../stores/useTeamStore";
import { useAutopilotStore } from "../stores/useAutopilotStore";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Square } from "lucide-react";
import { IpcService } from "../services/ipc";
import type { NavPage } from "../layouts/AppLayout";
import type { GlobalStats } from "@ai-orchestrator/shared-types";

interface DashboardPageProps {
  onNavigate: (page: NavPage) => void;
  onOpenNewTask: () => void;
}

export function DashboardPage({ onNavigate, onOpenNewTask }: DashboardPageProps) {
  const { currentProject, projects, selectDirectoryAndOpen } =
    useProjectStore();
  const { agents } = useAgentStore();
  const { allTasks, loadAllTasks } = useTaskStore();
  const {
    allExecutions,
    loadAllExecutions,
    activeAgentTask,
    loadActiveAgentTask,
    runAgentTask,
  } = useExecutionStore();
  const { openDrawer, openAgentStream } = useTerminalStore();
  const { config: globalTeamConfig } = useTeamStore();
  const {
    isRunning: isAutopilotRunning,
    currentPhase: autopilotPhase,
    statusMessage: autopilotStatus,
    activeTaskTitle: autopilotTaskTitle,
    activeBranchName: autopilotBranch,
    currentTaskIndex: autopilotTaskIndex,
    totalTasks: autopilotTotalTasks,
    stopAutopilot,
  } = useAutopilotStore();

  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchGlobalData = async () => {
    try {
      setIsRefreshing(true);
      const [globalStats] = await Promise.all([
        IpcService.statsGetGlobal(),
        loadAllTasks(20),
        loadAllExecutions(20),
        loadActiveAgentTask(),
      ]);
      setStats(globalStats);
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
    const timer = setInterval(() => {
      loadActiveAgentTask();
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleRunTask = async (taskId: string, agentId?: string) => {
    const targetAgentId = agentId || "claude";
    openDrawer();
    await runAgentTask(taskId, targetAgentId);
    await fetchGlobalData();
  };

  const readyAgentsCount = agents.filter((a) => a.status === "connected").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Global Orchestrator Dashboard</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time execution status, cross-project analytics, and autonomous multi-agent orchestration.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGlobalData}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 text-xs text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={onOpenNewTask}
            className="flex items-center space-x-1.5 text-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Live Active Execution / Autopilot Monitor Widget */}
      {isAutopilotRunning ? (
        <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-slate-900 border border-indigo-500/60 shadow-lg shadow-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
                Autonomous Autopilot Active
              </span>
              <Badge variant="outline" className="font-mono text-indigo-300 border-indigo-500/40 text-[10px] uppercase">
                {autopilotPhase}
              </Badge>
              {autopilotTotalTasks > 0 && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Task {autopilotTaskIndex} of {autopilotTotalTasks}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-100">
              {autopilotTaskTitle || autopilotStatus}
            </h3>
            <p className="text-xs text-slate-400 flex items-center space-x-2">
              <span className="text-slate-300">{autopilotStatus}</span>
              {autopilotBranch && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-indigo-400 font-mono text-[11px] flex items-center">
                    <GitBranch className="w-3 h-3 mr-1" />
                    {autopilotBranch}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <Button
              onClick={() => {
                if (activeAgentTask?.executionId) {
                  openAgentStream(activeAgentTask.executionId);
                } else {
                  openAgentStream();
                }
              }}
              size="sm"
              className="flex items-center space-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>View Terminal Stream</span>
            </Button>
            <Button
              onClick={stopAutopilot}
              size="sm"
              variant="outline"
              className="flex items-center space-x-1 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </Button>
          </div>
        </div>
      ) : activeAgentTask ? (
        <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/50 shadow-lg shadow-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
                Agent Task Currently Running
              </span>
              <Badge variant="outline" className="font-mono text-indigo-300 border-indigo-500/30 text-[10px]">
                {activeAgentTask.agentId}
              </Badge>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              {activeAgentTask.title}
            </h3>
            <p className="text-xs text-slate-400 flex items-center space-x-2">
              <span>Project:</span>
              <span className="font-semibold text-slate-200">{activeAgentTask.projectName}</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400/90 text-[11px]">Strict sequential lock active (1 task at a time)</span>
            </p>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <Button
              onClick={() => {
                if (activeAgentTask?.executionId) {
                  openAgentStream(activeAgentTask.executionId);
                } else {
                  openAgentStream();
                }
              }}
              size="sm"
              className="flex items-center space-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>View Terminal Stream</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span>
              <strong className="text-slate-300">All Agent CLIs Idle:</strong> Single-task execution lock is open. Ready for task orchestration.
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {readyAgentsCount} CLI agents detected & connected
          </span>
        </div>
      )}

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Tracked Projects */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tracked Projects
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-100">
                {stats?.totalProjects ?? projects.length}
              </span>
              <FolderOpen className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-[11px] text-slate-500 block truncate">
              {currentProject ? `Active: ${currentProject.name}` : "No active project"}
            </span>
          </CardContent>
        </Card>

        {/* Team Workflows */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Team Workflows
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-100">
                {stats?.totalWorkflows ?? 0}
              </span>
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-[11px] text-emerald-400 block truncate">
              {stats?.completedWorkflows ?? 0} completed / reviewed
            </span>
          </CardContent>
        </Card>

        {/* Total Tasks */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tasks Executed
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-100">
                {stats?.totalTasks ?? allTasks.length}
              </span>
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-[11px] text-slate-400 block truncate">
              {stats?.completedTasks ?? 0} completed successfully
            </span>
          </CardContent>
        </Card>

        {/* Pull Requests */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pull Requests
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-100">
                {stats?.totalPrs ?? 0}
              </span>
              <GitPullRequest className="w-4 h-4 text-pink-400" />
            </div>
            <span className="text-[11px] text-slate-500 block truncate">
              3-Tier PR generation enabled
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Current Workspace Spotlight & Quick Jump */}
      <Card className="border-slate-800 bg-slate-900/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
            <span className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Current Active Workspace</span>
            </span>
            {currentProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("projects")}
                className="text-xs h-7 flex items-center space-x-1.5"
              >
                <span>Open Project Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentProject ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5">
                  <span className="font-bold text-sm text-slate-100">{currentProject.name}</span>
                  {currentProject.hasGit && currentProject.git?.branch && (
                    <Badge variant="outline" className="font-mono text-indigo-300 border-indigo-500/30 text-[10px]">
                      <GitBranch className="w-3 h-3 mr-1" />
                      {currentProject.git.branch}
                    </Badge>
                  )}
                  <Badge variant={currentProject.hasGit ? "success" : "warning"} className="text-[10px]">
                    {currentProject.hasGit ? "Git Connected" : "No Git"}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-slate-400 truncate max-w-xl">
                  {currentProject.path}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={() => onNavigate("projects")}
                  className="text-xs"
                >
                  View Project Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("team")}
                  className="text-xs"
                >
                  Orchestrate Team
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500 space-y-3">
              <p>No project selected. Open or select a repository to view its dedicated dashboard.</p>
              <Button onClick={() => selectDirectoryAndOpen()} size="sm" className="text-xs">
                Open Project Folder
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Team Composition Card */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
            <span className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Global Autonomous Team (Auto-Assigned to All Projects)</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("team")}
              className="text-xs h-7"
            >
              Configure Team
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Plan Manager */}
            {(() => {
              const agentsList = globalTeamConfig.planManagerAgents || [];
              const primary = agentsList[0] || globalTeamConfig.planManagerAgentId || "Unassigned";
              const fallbacks = agentsList.slice(1);
              return (
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                      Plan Manager
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">
                      Phase 1
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                      #1 Primary
                    </span>
                    <span className="font-semibold text-xs text-slate-200 font-mono">{primary}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Fallback:{" "}
                    {fallbacks.length > 0
                      ? fallbacks.join(" ➔ ")
                      : globalTeamConfig.planManagerFallbackAgentId || "None"}
                  </div>
                </div>
              );
            })()}

            {/* Developer */}
            {(() => {
              const agentsList = globalTeamConfig.developerAgents || [];
              const primary = agentsList[0] || globalTeamConfig.developerAgentId || "Unassigned";
              const fallbacks = agentsList.slice(1);
              return (
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
                      Developer
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">
                      Phase 2
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      #1 Primary
                    </span>
                    <span className="font-semibold text-xs text-slate-200 font-mono">{primary}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Fallback:{" "}
                    {fallbacks.length > 0
                      ? fallbacks.join(" ➔ ")
                      : globalTeamConfig.developerFallbackAgentId || "None"}
                  </div>
                </div>
              );
            })()}

            {/* QA Tester */}
            {(() => {
              const agentsList = globalTeamConfig.testerAgents || [];
              const primary = agentsList[0] || globalTeamConfig.testerAgentId || "Unassigned";
              const fallbacks = agentsList.slice(1);
              return (
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                      QA Tester
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">
                      Phase 3
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                      #1 Primary
                    </span>
                    <span className="font-semibold text-xs text-slate-200 font-mono">{primary}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Fallback:{" "}
                    {fallbacks.length > 0
                      ? fallbacks.join(" ➔ ")
                      : globalTeamConfig.testerFallbackAgentId || "None"}
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Cross-Project Recent Tasks & Executions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Tasks Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Recent Cross-Project Tasks</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("tasks")}
                className="text-xs text-slate-400 hover:text-slate-200 h-7"
              >
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allTasks.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No tasks created yet.
              </div>
            ) : (
              allTasks.slice(0, 5).map((t) => {
                const isLocked = Boolean(activeAgentTask);
                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                  >
                    <div className="space-y-0.5 max-w-[70%]">
                      <div className="font-medium text-slate-200 truncate">{t.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {t.agentId ? `Agent: ${t.agentId}` : "Unassigned"}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          t.status === "completed"
                            ? "success"
                            : t.status === "running"
                            ? "default"
                            : t.status === "failed"
                            ? "danger"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {t.status}
                      </Badge>

                      {t.status !== "running" && (
                        <button
                          disabled={isLocked}
                          onClick={() => handleRunTask(t.id, t.agentId)}
                          className={`p-1.5 rounded transition ${
                            isLocked
                              ? "bg-slate-800/40 text-slate-600 cursor-not-allowed"
                              : "bg-slate-800 text-slate-300 hover:text-white hover:bg-indigo-600"
                          }`}
                          title={isLocked ? "Execution locked" : "Execute Task"}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Executions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
              <span className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Recent Process Executions</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("executions")}
                className="text-xs text-slate-400 hover:text-slate-200 h-7"
              >
                View History
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allExecutions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No process executions recorded yet.
              </div>
            ) : (
              allExecutions.slice(0, 5).map((exec) => (
                <div
                  key={exec.id}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-slate-300">
                      {exec.agentId ? `Agent: ${exec.agentId}` : "Shell Command"}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {new Date(exec.startedAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        exec.status === "completed"
                          ? "success"
                          : exec.status === "running"
                          ? "default"
                          : "danger"
                      }
                      className="text-[10px]"
                    >
                      {exec.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
