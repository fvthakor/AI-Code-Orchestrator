import React, { useState } from "react";
import { PlusCircle, Bot, Play, X, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useAgentStore } from "../stores/useAgentStore";
import { useTaskStore } from "../stores/useTaskStore";
import { useExecutionStore } from "../stores/useExecutionStore";
import { useProjectStore } from "../stores/useProjectStore";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskStarted?: (taskId: string, executionId: string) => void;
}

export function NewTaskModal({ isOpen, onClose, onTaskStarted }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("claude");
  const [runImmediately, setRunImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { agents } = useAgentStore();
  const { currentProject } = useProjectStore();
  const { createTask } = useTaskStore();
  const { runAgentTask } = useExecutionStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a task title");
      return;
    }
    if (!currentProject) {
      setError("No active project selected");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const task = await createTask(
        currentProject.id,
        title.trim(),
        description.trim(),
        selectedAgentId
      );

      if (!task) {
        throw new Error("Failed to create task");
      }

      if (runImmediately && selectedAgentId) {
        const executionId = await runAgentTask(task.id, selectedAgentId);
        if (executionId && onTaskStarted) {
          onTaskStarted(task.id, executionId);
        }
      }

      setTitle("");
      setDescription("");
      onClose();
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Create New AI Task</h3>
              <p className="text-xs text-slate-400">
                Dispatch an instruction to a local AI coding agent inside {currentProject?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <Input
              placeholder="e.g. Implement user login API with JWT tokens"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Task Prompt / Description
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] resize-y"
              placeholder="Describe what files to change, requirements, test commands to run..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Assign AI Agent Adapter
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {agents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                const isInstalled = agent.status === "connected";

                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? "bg-indigo-600/15 border-indigo-500 text-indigo-100"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium text-xs text-slate-200">{agent.name}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isInstalled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {isInstalled ? "Ready" : "Missing"}
                      </span>
                      {agent.version && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          v{agent.version}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={runImmediately}
                onChange={(e) => setRunImmediately(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 rounded focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-300">
                Execute immediately after creating (opens streaming terminal)
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center space-x-2"
            >
              {runImmediately ? (
                <>
                  <Play className="w-4 h-4" />
                  <span>{isSubmitting ? "Starting..." : "Create & Run Task"}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isSubmitting ? "Saving..." : "Save Task"}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
