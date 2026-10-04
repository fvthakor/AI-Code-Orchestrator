import { useEffect, useState } from "react";
import {
  FolderOpen,
  Code2,
  Cpu,
  GitBranch,
  Bot,
  Play,
  Terminal,
  RefreshCw,
  PlusCircle,
  Clock,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { useProjectStore } from "../stores/useProjectStore";
import { useAgentStore } from "../stores/useAgentStore";
import { useTaskStore } from "../stores/useTaskStore";
import { useExecutionStore } from "../stores/useExecutionStore";
import { useTerminalStore } from "../stores/useTerminalStore";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import type { NavPage } from "../layouts/AppLayout";

interface DashboardPageProps {
  onNavigate: (page: NavPage) => void;
  onOpenNewTask: () => void;
}

export function DashboardPage({ onNavigate, onOpenNewTask }: DashboardPageProps) {
  const { currentProject, selectDirectoryAndOpen, analyzeProject, isLoading: isProjectLoading } =
    useProjectStore();
  const { agents, testConnection, detectAll } = useAgentStore();
  const { tasks, loadTasks } = useTaskStore();
  const { executions, loadExecutions, runAgentTask } = useExecutionStore();
  const { spawnSession, openDrawer } = useTerminalStore();

  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadTasks(currentProject.id);
      loadExecutions(currentProject.id);
    }
  }, [currentProject, loadTasks, loadExecutions]);

  const handleTestAgent = async (agentId: string) => {
    try {
      setTestingAgentId(agentId);
      await testConnection(agentId);
    } finally {
      setTestingAgentId(null);
    }
  };

  const handleRunTask = async (taskId: string, agentId?: string) => {
    const targetAgentId = agentId || "claude";
    openDrawer();
    await runAgentTask(taskId, targetAgentId);
  };

  const handleOpenTerminal = () => {
    openDrawer();
    spawnSession(currentProject?.id);
  };

  if (!currentProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5 animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <FolderOpen className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">No Project Opened</h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Select a local code repository to start orchestrating Claude, Codex, and OpenCode
            coding agents on Windows.
          </p>
        </div>
        <Button onClick={() => selectDirectoryAndOpen()} className="flex items-center space-x-2">
          <FolderOpen className="w-4 h-4" />
          <span>Open Project Folder</span>
        </Button>
      </div>
    );
  }

  const recentTasks = tasks.slice(0, 5);
  const recentExecutions = executions.slice(0, 5);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Top Project Banner */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              {currentProject.name}
            </h2>
            {currentProject.git?.branch && (
              <Badge variant="outline" className="font-mono text-indigo-300 border-indigo-500/30">
                <GitBranch className="w-3 h-3 mr-1" />
                {currentProject.git.branch}
              </Badge>
            )}
            <Badge
              variant={currentProject.git?.isClean ? "success" : "warning"}
              className="text-[10px]"
            >
              {currentProject.git?.isClean ? "Clean" : "Modified"}
            </Badge>
          </div>
          <p className="text-xs font-mono text-slate-400 truncate max-w-xl">
            {currentProject.path}
          </p>
        </div>

        {/* Banner Quick Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeProject(currentProject.id)}
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

      {/* Tech Stack & Git Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Tech Stack Card */}
        <Card className="md:col-span-2">
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
                {currentProject.stack?.languages.map((lang: string) => (
                  <Badge key={lang} variant="default" className="bg-indigo-600/20 text-indigo-200 border border-indigo-500/30">
                    <Code2 className="w-3 h-3 mr-1" />
                    {lang}
                  </Badge>
                ))}
                {currentProject.stack?.frameworks.map((fw: string) => (
                  <Badge key={fw} variant="default" className="bg-violet-600/20 text-violet-200 border border-violet-500/30">
                    <Cpu className="w-3 h-3 mr-1" />
                    {fw}
                  </Badge>
                ))}
                {(!currentProject.stack || (currentProject.stack.languages.length === 0 && currentProject.stack.frameworks.length === 0)) && (
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
                  {currentProject.stack?.packageManagers && currentProject.stack.packageManagers.length > 0 ? (
                    currentProject.stack.packageManagers.map((pm: string) => (
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
                  {currentProject.stack && [...currentProject.stack.databases, ...currentProject.stack.infrastructure].length > 0 ? (
                    [...currentProject.stack.databases, ...currentProject.stack.infrastructure].map((item: string) => (
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
        </Card>

        {/* Git Status Card */}
        <Card>
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
            {currentProject.git ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Current Branch:</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {currentProject.git.branch || "HEAD"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Working Tree:</span>
                  <span
                    className={`font-medium ${
                      currentProject.git.isClean ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {currentProject.git.isClean ? "Clean" : "Modified"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Untracked Files:</span>
                  <span className="font-mono text-slate-300">
                    {currentProject.git.untrackedFiles.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Modified Files:</span>
                  <span className="font-mono text-slate-300">
                    {currentProject.git.modifiedFiles.length}
                  </span>
                </div>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => onNavigate("changes")}
                  >
                    Manage Git Changes
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-xs text-slate-500">
                Not a Git repository
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Agents Status Row */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span>AI Coding Agents (Windows Adapters)</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => detectAll()}
            className="text-xs text-indigo-300 hover:text-indigo-200 h-7"
          >
            Rescan CLI Agents
          </Button>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-3 gap-4 min-w-[860px]">
            {agents.map((agent) => {
              const isInstalled = agent.status === "connected";
              const isTesting = testingAgentId === agent.id;

              return (
                <div
                  key={agent.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="font-semibold text-sm text-slate-200 truncate whitespace-nowrap">{agent.name}</span>
                      <Badge variant={isInstalled ? "success" : "warning"} className="text-[10px] shrink-0">
                        {agent.status}
                      </Badge>
                    </div>

                    <div
                      className="text-[11px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80 overflow-x-auto whitespace-nowrap select-all"
                      title={agent.executablePath || "Not in PATH"}
                    >
                      {agent.executablePath || "Executable not detected in PATH"}
                    </div>

                    {agent.version && (
                      <div className="text-[11px] text-slate-400 mt-1.5 font-mono flex items-center justify-between">
                        <span className="text-slate-500 whitespace-nowrap">Detected:</span>
                        <span className="font-semibold text-slate-300">v{agent.version}</span>
                      </div>
                    )}

                    {agent.capabilities && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {agent.capabilities.fileEditing && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 whitespace-nowrap">
                            Edit Files
                          </span>
                        )}
                        {agent.capabilities.terminal && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 whitespace-nowrap">
                            Terminal
                          </span>
                        )}
                        {agent.capabilities.git && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 whitespace-nowrap">
                            Git
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isTesting}
                      onClick={() => handleTestAgent(agent.id)}
                      className="text-xs h-7 px-2 text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
                    >
                      {isTesting ? "Testing..." : "Test Connection"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate("agents")}
                      className="text-xs h-7 px-2 whitespace-nowrap"
                    >
                      Configure
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Tasks & Executions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Tasks Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Recent Tasks</span>
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
              <div className="text-center py-6 text-xs text-slate-500">
                No tasks created yet. Click "+ New Task" to start.
              </div>
            ) : (
              recentTasks.map((t) => (
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
                        onClick={() => handleRunTask(t.id, t.agentId)}
                        className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-indigo-600 transition"
                        title="Execute Task"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Executions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
              <span className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Recent Executions</span>
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
              <div className="text-center py-6 text-xs text-slate-500">
                No process executions recorded yet.
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
        </Card>
      </div>
    </div>
  );
}
