import { useState } from "react";
import {
  Plus,
  Play,
  Trash2,
  Bot,
  Search,
} from "lucide-react";
import { useTaskStore } from "../stores/useTaskStore";
import { useProjectStore } from "../stores/useProjectStore";
import { useExecutionStore } from "../stores/useExecutionStore";
import { useTerminalStore } from "../stores/useTerminalStore";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import type { TaskStatus } from "@ai-orchestrator/shared-types";

interface TasksPageProps {
  onOpenNewTask: () => void;
}

export function TasksPage({ onOpenNewTask }: TasksPageProps) {
  const { currentProject } = useProjectStore();
  const { tasks, deleteTask } = useTaskStore();
  const { runAgentTask } = useExecutionStore();
  const { openDrawer } = useTerminalStore();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  const handleRunTask = async (taskId: string, agentId?: string) => {
    try {
      setRunningTaskId(taskId);
      openDrawer();
      await runAgentTask(taskId, agentId || "claude");
    } finally {
      setRunningTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesFilter = filterStatus === "all" || t.status === filterStatus;
    const matchesQuery =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "running":
        return <Badge variant="default" className="bg-indigo-600 animate-pulse">Running</Badge>;
      case "failed":
        return <Badge variant="danger">Failed</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      case "pending":
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (!currentProject) {
    return (
      <div className="text-center py-16 text-slate-500 text-xs">
        Please open a project to view and manage tasks.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Tasks</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage and execute AI coding tasks inside {currentProject.name}.
          </p>
        </div>

        <Button onClick={onOpenNewTask} className="flex items-center space-x-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {["all", "pending", "running", "completed", "failed", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                filterStatus === st
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            No tasks found matching current filters.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCurrentlyRunning = runningTaskId === task.id || task.status === "running";

            return (
              <div
                key={task.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center space-x-2.5">
                      <h3 className="font-semibold text-sm text-slate-200 truncate">
                        {task.title}
                      </h3>
                      {getStatusBadge(task.status)}
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {task.status !== "running" && (
                      <Button
                        size="sm"
                        disabled={isCurrentlyRunning}
                        onClick={() => handleRunTask(task.id, task.agentId)}
                        className="flex items-center space-x-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{isCurrentlyRunning ? "Running..." : "Run"}</span>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTask(task.id)}
                      className="text-slate-500 hover:text-rose-400 p-2"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Bot className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{task.agentId ? `Agent: ${task.agentId}` : "Unassigned"}</span>
                    </span>
                    <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
                  </div>

                  {task.completedAt && (
                    <span>Completed: {new Date(task.completedAt).toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
