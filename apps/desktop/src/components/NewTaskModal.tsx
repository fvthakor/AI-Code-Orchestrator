import React, { useState } from "react";
import {
  PlusCircle,
  Bot,
  Play,
  X,
  Sparkles,
  CheckCircle2,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useAgentStore } from "../stores/useAgentStore";
import { useTaskStore } from "../stores/useTaskStore";
import { useExecutionStore } from "../stores/useExecutionStore";
import { useProjectStore } from "../stores/useProjectStore";
import { useTeamStore } from "../stores/useTeamStore";
import { useAutopilotStore } from "../stores/useAutopilotStore";
import { useTerminalStore } from "../stores/useTerminalStore";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskStarted?: (taskId: string, executionId: string) => void;
}

export function NewTaskModal({ isOpen, onClose, onTaskStarted }: NewTaskModalProps) {
  const [mode, setMode] = useState<"autonomous" | "single">("autonomous");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("opencode");
  const [runImmediately, setRunImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { agents } = useAgentStore();
  const { currentProject } = useProjectStore();
  const { createTask } = useTaskStore();
  const { runAgentTask } = useExecutionStore();
  const { config: teamConfig } = useTeamStore();
  const { startAutopilot } = useAutopilotStore();
  const { openAgentStream } = useTerminalStore();

  const planManager =
    teamConfig.planManagerAgents?.[0] || teamConfig.planManagerAgentId || "claude";
  const developer =
    teamConfig.developerAgents?.[0] || teamConfig.developerAgentId || "opencode";
  const tester =
    teamConfig.testerAgents?.[0] || teamConfig.testerAgentId || "antigravity";

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a project goal or task title");
      return;
    }
    if (!currentProject) {
      setError("No active project selected. Please open or create a project folder first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (mode === "autonomous") {
        // Mode 1: Full Autonomous Team Pipeline
        await startAutopilot({
          projectId: currentProject.id,
          title: title.trim(),
          description: description.trim(),
        });
        openAgentStream();
        setTitle("");
        setDescription("");
        onClose();
        return;
      }

      // Mode 2: Single Agent Task
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
        if (executionId) {
          openAgentStream(executionId);
          if (onTaskStarted) {
            onTaskStarted(task.id, executionId);
          }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {mode === "autonomous" ? (
                <Users className="w-5 h-5 text-indigo-400" />
              ) : (
                <PlusCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                {mode === "autonomous" ? "Autonomous Team Project Goal" : "Create Single AI Task"}
              </h3>
              <p className="text-xs text-slate-400">
                {currentProject ? `Target project: ${currentProject.name}` : "No project open"}
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

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 space-x-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("autonomous")}
            className={`pb-2.5 flex items-center space-x-2 border-b-2 transition ${
              mode === "autonomous"
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Autonomous Team (Full Automation)</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
              Zero Clicks
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`pb-2.5 flex items-center space-x-2 border-b-2 transition ${
              mode === "single"
                ? "border-indigo-500 text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Single Agent Task</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              {error}
            </div>
          )}

          {/* Autonomous Team Cascade Banner */}
          {mode === "autonomous" && (
            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 space-y-2">
              <div className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
                <span>Active Global Team Pipeline</span>
                <span className="text-[10px] text-emerald-400 font-mono">Auto-advance active</span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-300 overflow-x-auto py-1">
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-200">
                  Plan: {planManager}
                </span>
                <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-emerald-300">
                  Dev: {developer}
                </span>
                <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-cyan-300">
                  QA: {tester}
                </span>
                <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-purple-300">
                  Git Push
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Plan Manager analyzes requirements and generates tasks one-by-one. Developer executes code with zero permission prompts, QA Tester verifies, and changes are pushed to remote Git branches.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              {mode === "autonomous" ? "Project Goal / Feature Title" : "Task Title"}{" "}
              <span className="text-rose-400">*</span>
            </label>
            <Input
              placeholder={
                mode === "autonomous"
                  ? "e.g. Build AI appointment booking chatbot with slot management"
                  : "e.g. Implement user login API with JWT tokens"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              {mode === "autonomous" ? "Requirements & Detailed Specifications" : "Task Prompt / Description"}
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] resize-y"
              placeholder={
                mode === "autonomous"
                  ? "Specify all requirements: LLM providers (OpenAI, Claude, DeepSeek), slot booking logic, collision checks, user prompts, error handling, etc."
                  : "Describe what files to change, requirements, test commands to run..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {mode === "single" && (
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
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {mode === "autonomous" ? (
                <>
                  <Users className="w-4 h-4" />
                  <span>{isSubmitting ? "Orchestrating..." : "Launch Autonomous Pipeline"}</span>
                </>
              ) : runImmediately ? (
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
