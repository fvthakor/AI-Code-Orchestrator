import { useEffect, useState } from "react";
import {
  FolderOpen,
  Code2,
  Cpu,
  GitBranch,
  Play,
  Terminal,
  RefreshCw,
  PlusCircle,
  Clock,
  ShieldCheck,
  Layers,
  Users,
  X,
  ChevronRight,
} from "lucide-react";
import { useProjectStore } from "../../stores/useProjectStore";
import { useTaskStore } from "../../stores/useTaskStore";
import { useExecutionStore } from "../../stores/useExecutionStore";
import { useTerminalStore } from "../../stores/useTerminalStore";
import { useTeamStore } from "../../stores/useTeamStore";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { GitInitCard } from "../git/GitInitCard";
import type { NavPage } from "../../layouts/AppLayout";
import type { ProjectContext } from "@ai-orchestrator/shared-types";

interface ProjectDashboardProps {
  project: ProjectContext;
  onNavigate: (page: NavPage) => void;
  onOpenNewTask: () => void;
  onSwitchProjectClick?: () => void;
}

export function ProjectDashboard({
  project,
  onNavigate,
  onOpenNewTask,
  onSwitchProjectClick,
}: ProjectDashboardProps) {
  const { analyzeProject, isLoading: isProjectLoading } = useProjectStore();
  const { tasks, loadTasks } = useTaskStore();
  const { executions, loadExecutions, runAgentTask, activeAgentTask, loadActiveAgentTask } =
    useExecutionStore();
  const { spawnSession, openDrawer } = useTerminalStore();
  const {
    workflows,
    loadWorkflows,
    selectWorkflow,
    startWorkflow,
    config: globalTeamConfig,
  } = useTeamStore();

  const [isRunningTaskId, setIsRunningTaskId] = useState<string | null>(null);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [wfTitle, setWfTitle] = useState("");
  const [wfGoal, setWfGoal] = useState("");
  const [isGreenfield, setIsGreenfield] = useState(false);
  const [isSubmittingWf, setIsSubmittingWf] = useState(false);

  useEffect(() => {
    if (project?.id) {
      loadTasks(project.id);
      loadExecutions(project.id);
      loadWorkflows(project.id);
      loadActiveAgentTask();
    }
  }, [project?.id, loadTasks, loadExecutions, loadWorkflows, loadActiveAgentTask]);

  const handleLaunchWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id || !wfTitle.trim() || !wfGoal.trim()) return;
    try {
      setIsSubmittingWf(true);
      const newWf = await startWorkflow({
        projectId: project.id,
        title: wfTitle.trim(),
        goal: wfGoal.trim(),
        isGreenfield,
      });
      setIsLaunchModalOpen(false);
      setWfTitle("");
      setWfGoal("");
      if (newWf) {
        selectWorkflow(newWf.id);
      }
      onNavigate("team");
    } finally {
      setIsSubmittingWf(false);
    }
  };

  const handleRunTask = async (taskId: string, agentId?: string) => {
    const targetAgentId = agentId || "claude";
    try {
      setIsRunningTaskId(taskId);
      openDrawer();
      await runAgentTask(taskId, targetAgentId);
    } finally {
      setIsRunningTaskId(null);
    }
  };

  const handleOpenTerminal = () => {
    openDrawer();
    spawnSession(project.id);
  };

  const recentTasks = tasks.slice(0, 5);
  const recentExecutions = executions.slice(0, 5);
  const projectWorkflows = workflows.slice(0, 3);

  const hasGit = Boolean(project.hasGit && project.git);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Top Project Banner */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/60 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              {project.name}
            </h2>
            {hasGit && project.git?.branch && (
              <Badge variant="outline" className="font-mono text-indigo-300 border-indigo-500/30">
                <GitBranch className="w-3 h-3 mr-1" />
                {project.git.branch}
              </Badge>
            )}
            {hasGit && (
              <Badge
                variant={project.git?.isClean ? "success" : "warning"}
                className="text-[10px]"
              >
                {project.git?.isClean ? "Clean" : "Modified"}
              </Badge>
            )}
            {!hasGit && (
              <Badge variant="warning" className="text-[10px]">
                No Git
              </Badge>
            )}
          </div>
          <p className="text-xs font-mono text-slate-400 truncate max-w-xl">
            {project.path}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {onSwitchProjectClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchProjectClick}
              className="flex items-center space-x-1.5 text-xs text-slate-300"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>All Projects</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeProject(project.id)}
            disabled={isProjectLoading}
            className="flex items-center space-x-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProjectLoading ? "animate-spin" : ""}`} />
            <span>Rescan</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenTerminal}
            className="flex items-center space-x-1.5 text-xs text-cyan-300 border-cyan-500/30"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
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

      {/* Sequential Lock Warning If Another Task is Active */}
      {activeAgentTask && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div>
              <span className="font-semibold text-amber-300">Single-Task Execution Lock Active:</span>{" "}
              Agent <span className="font-mono font-medium">{activeAgentTask.agentId}</span> is executing task "
              <span className="font-medium text-slate-100">{activeAgentTask.title}</span>" on{" "}
              <span className="font-medium text-indigo-300">{activeAgentTask.projectName}</span>.
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={openDrawer}
            className="text-xs h-7 text-amber-300 hover:text-amber-100 underline"
          >
            View Live Stream
          </Button>
        </div>
      )}

      {/* Tech Stack & Git Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {/* Tech Stack Card */}
        <Card className="md:col-span-2 flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center space-x-2 text-slate-200">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Detected Technology Stack</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Languages & Frameworks
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {project.stack?.languages.map((lang: string) => (
                    <Badge key={lang} variant="default" className="bg-indigo-600/20 text-indigo-200 border border-indigo-500/30">
                      <Code2 className="w-3 h-3 mr-1" />
                      {lang}
                    </Badge>
                  ))}
                  {project.stack?.frameworks.map((fw: string) => (
                    <Badge key={fw} variant="default" className="bg-violet-600/20 text-violet-200 border border-violet-500/30">
                      <Cpu className="w-3 h-3 mr-1" />
                      {fw}
                    </Badge>
                  ))}
                  {(!project.stack || (project.stack.languages.length === 0 && project.stack.frameworks.length === 0)) && (
                    <span className="text-xs text-slate-500 italic">No specific languages detected</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Package Managers
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {project.stack?.packageManagers && project.stack.packageManagers.length > 0 ? (
                      project.stack.packageManagers.map((pm: string) => (
                        <Badge key={pm} variant="outline" className="text-xs text-slate-300">
                          {pm}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">None detected</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Infrastructure & Databases
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {project.stack && [...project.stack.databases, ...project.stack.infrastructure].length > 0 ? (
                      [...project.stack.databases, ...project.stack.infrastructure].map((item: string) => (
                        <Badge key={item} variant="outline" className="text-xs text-slate-300">
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">None detected</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* Git Card: Auto-detects if .git exists, else displays GitInitCard */}
        {hasGit && project.git ? (
          <Card className="md:col-span-1 flex flex-col justify-between h-full">
            <div>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
                  <span className="flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-emerald-400" />
                    <span>Git Repository</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate("changes")}
                    className="text-xs text-slate-400 hover:text-slate-200 h-7 px-2"
                  >
                    View Diff
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Current Branch:</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {project.git.branch || "HEAD"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Working Tree:</span>
                  <span
                    className={`font-medium ${
                      project.git.isClean ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {project.git.isClean ? "Clean" : "Modified"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Untracked Files:</span>
                  <span className="font-mono text-slate-300">
                    {project.git.untrackedFiles.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Modified Files:</span>
                  <span className="font-mono text-slate-300">
                    {project.git.modifiedFiles.length}
                  </span>
                </div>
              </CardContent>
            </div>
            <div className="p-6 pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onNavigate("changes")}
              >
                Manage Git Changes
              </Button>
            </div>
          </Card>
        ) : (
          <div className="md:col-span-1 h-full">
            <GitInitCard
              projectId={project.id}
              projectName={project.name}
              projectPath={project.path}
            />
          </div>
        )}
      </div>

      {/* Autonomous Multi-Agent Team (Auto-Assigned Globally) */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-200">
            <span className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Project Autonomous Team</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-normal">
                ✓ Auto-Assigned Globally
              </Badge>
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("team")}
                className="text-xs h-7 text-slate-300 hover:text-slate-100"
              >
                Configure Team
              </Button>
              <Button
                size="sm"
                onClick={() => setIsLaunchModalOpen(true)}
                className="text-xs h-7 bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-1 shadow-sm"
              >
                <Play className="w-3 h-3 fill-white mr-1" />
                <span>Launch Team Workflow</span>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active 3-Agent Role Roster */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Plan Manager */}
            {(() => {
              const agentsList = globalTeamConfig.planManagerAgents || [];
              const primary = agentsList[0] || globalTeamConfig.planManagerAgentId || "claude";
              const fallbacks = agentsList.slice(1);
              return (
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                      Plan Manager
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">
                      Phase 1 • Architect
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
              const primary = agentsList[0] || globalTeamConfig.developerAgentId || "codex";
              const fallbacks = agentsList.slice(1);
              return (
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
                      Developer
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">
                      Phase 2 • Builder
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
              const primary = agentsList[0] || globalTeamConfig.testerAgentId || "antigravity";
              const fallbacks = agentsList.slice(1);
              return (
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                      QA Tester
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">
                      Phase 3 • Verification
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

          {/* Workflow Status / Executions */}
          {projectWorkflows.length === 0 ? (
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
              <div className="flex items-center space-x-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>
                  Team ready on <strong className="text-slate-100">{project.name}</strong> with automated 3-tier PR generation.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsLaunchModalOpen(true)}
                className="text-xs h-7 text-indigo-400 hover:text-indigo-300 border-slate-700 shrink-0 flex items-center space-x-1"
              >
                <span>Start First Workflow</span>
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Workflow Executions on this Project ({projectWorkflows.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {projectWorkflows.map((wf) => (
                  <div
                    key={wf.id}
                    onClick={() => {
                      selectWorkflow(wf.id);
                      onNavigate("team");
                    }}
                    className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer space-y-2 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-200 truncate">{wf.title}</span>
                      <Badge
                        variant={wf.phase === "completed" ? "success" : wf.phase === "reviewing" ? "warning" : "default"}
                        className="text-[10px]"
                      >
                        {wf.phase}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{wf.goal}</p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {wf.prUrl ? "PR Created" : `Step ${wf.currentStepIndex + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Tasks & Executions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Recent Tasks Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
                <span className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Project Tasks</span>
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
              {recentTasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 space-y-2.5">
                  <p>No tasks created yet for this project.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onOpenNewTask}
                    className="text-xs h-7 text-indigo-400 hover:text-indigo-300 border-slate-700 inline-flex items-center"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    <span>Create First Task</span>
                  </Button>
                </div>
              ) : (
                recentTasks.map((t) => {
                  const isLocked = Boolean(activeAgentTask);
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                    >
                      <div className="space-y-0.5 max-w-[70%]">
                        <div className="font-medium text-slate-200 truncate">{t.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {t.agentId ? `Assigned: ${t.agentId}` : "Unassigned"}
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
                            disabled={isLocked || isRunningTaskId === t.id}
                            onClick={() => handleRunTask(t.id, t.agentId)}
                            className={`p-1.5 rounded transition ${
                              isLocked
                                ? "bg-slate-800/40 text-slate-600 cursor-not-allowed"
                                : "bg-slate-800 text-slate-300 hover:text-white hover:bg-indigo-600"
                            }`}
                            title={isLocked ? "Execution locked: another task is running" : "Execute Task"}
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
          </div>
        </Card>

        {/* Recent Executions Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
                <span className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Project Executions</span>
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
              {recentExecutions.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 space-y-1">
                  <p>No process executions recorded for this project yet.</p>
                  <p className="text-[11px] text-slate-600">
                    Run a task or launch a team workflow above to begin execution.
                  </p>
                </div>
              ) : (
                recentExecutions.map((exec) => (
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
          </div>
        </Card>
      </div>

      {/* Launch Team Workflow Modal */}
      {isLaunchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-slate-100 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Launch Team Workflow</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Project: <span className="text-indigo-300">{project.name}</span>
                </p>
              </div>
              <button
                onClick={() => setIsLaunchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Global Team Roster Summary */}
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Executing Team (Globally Configured)
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-indigo-400 block font-semibold">Plan Manager</span>
                  <span className="font-mono text-slate-200 truncate block">
                    {globalTeamConfig.planManagerAgents?.[0] || globalTeamConfig.planManagerAgentId || "claude"}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-emerald-400 block font-semibold">Developer</span>
                  <span className="font-mono text-slate-200 truncate block">
                    {globalTeamConfig.developerAgents?.[0] || globalTeamConfig.developerAgentId || "codex"}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-amber-400 block font-semibold">QA Tester</span>
                  <span className="font-mono text-slate-200 truncate block">
                    {globalTeamConfig.testerAgents?.[0] || globalTeamConfig.testerAgentId || "antigravity"}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleLaunchWorkflow} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Workflow Title</label>
                <Input
                  placeholder="e.g. Implement user authentication middleware"
                  value={wfTitle}
                  onChange={(e) => setWfTitle(e.target.value)}
                  required
                  autoFocus
                  className="text-xs bg-slate-950"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Goal & Instructions</label>
                <textarea
                  placeholder="Describe requirements, acceptance criteria, or files to inspect..."
                  value={wfGoal}
                  onChange={(e) => setWfGoal(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isGreenfield}
                    onChange={(e) => setIsGreenfield(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 rounded"
                  />
                  <span>Greenfield project (brand new scaffold / no pre-existing architecture)</span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsLaunchModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingWf || !wfTitle.trim() || !wfGoal.trim()}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-1.5 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{isSubmittingWf ? "Launching Pipeline..." : "Start Team Execution"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
