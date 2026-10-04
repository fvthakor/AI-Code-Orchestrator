import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  CheckCircle2,
  FolderPlus,
  Code2,
  X,
  History,
} from "lucide-react";
import { useTeamStore } from "../stores/useTeamStore";
import { useProjectStore } from "../stores/useProjectStore";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { RoleSelector } from "../components/team/RoleSelector";
import { TeamKanbanBoard } from "../components/team/TeamKanbanBoard";
import { PrModal } from "../components/team/PrModal";

export function TeamPage() {
  const { currentProject } = useProjectStore();
  const {
    workflows,
    activeWorkflow,
    loadWorkflows,
    selectWorkflow,
    startWorkflow,
    createPr,
    prResult,
    isPrModalOpen,
    setPrModalOpen,
  } = useTeamStore();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [isGreenfield, setIsGreenfield] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentProject) {
      loadWorkflows(currentProject.id);
    }
  }, [currentProject, loadWorkflows]);

  const handleStartWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !title.trim() || !goal.trim()) return;

    try {
      setIsSubmitting(true);
      await startWorkflow({
        projectId: currentProject.id,
        title: title.trim(),
        goal: goal.trim(),
        isGreenfield,
      });

      setIsNewModalOpen(false);
      setTitle("");
      setGoal("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerPr = async () => {
    if (!currentProject || !activeWorkflow) return;
    const branch = activeWorkflow.branchName || `feat/${activeWorkflow.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    await createPr({
      projectId: currentProject.id,
      branchName: branch,
      title: `feat: ${activeWorkflow.title}`,
      body: `## Summary\n${activeWorkflow.goal}\n\n## Verification\nExecuted and verified by autonomous multi-agent team (Plan Manager, Developer, QA Tester).`,
      githubRepoUrl: githubUrl.trim() || undefined,
    });
  };

  if (!currentProject) {
    return (
      <div className="text-center py-16 text-slate-500 text-xs">
        Please open a project to orchestrate autonomous AI teams.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Autonomous Team Orchestration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Plan Manager ➔ Developer ➔ QA Tester with automated 3-Tier GitHub PR integration.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {workflows.length > 0 && (
            <select
              value={activeWorkflow?.id || ""}
              onChange={(e) => selectWorkflow(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} ({w.phase})
                </option>
              ))}
            </select>
          )}

          <Button onClick={() => setIsNewModalOpen(true)} className="flex items-center space-x-1.5 text-xs">
            <Plus className="w-4 h-4" />
            <span>Launch Team Workflow</span>
          </Button>
        </div>
      </div>

      {/* Role Configurations Card */}
      <RoleSelector />

      {/* Live Kanban Board */}
      <TeamKanbanBoard onOpenPrModal={handleTriggerPr} />

      {/* Workflow History Card */}
      {workflows.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>Team Workflow History</span>
          </h3>
          <div className="divide-y divide-slate-800/60">
            {workflows.map((w) => (
              <div
                key={w.id}
                onClick={() => selectWorkflow(w.id)}
                className={`py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-800/40 px-2 rounded transition ${
                  activeWorkflow?.id === w.id ? "bg-slate-800/60 text-indigo-200" : "text-slate-400"
                }`}
              >
                <div className="space-y-0.5">
                  <span className="font-medium text-slate-200">{w.title}</span>
                  <div className="text-[11px] text-slate-500">{w.goal}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[10px] text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 uppercase font-semibold text-slate-300">
                    {w.phase}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Launch New Workflow Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Launch Autonomous Team Workflow</span>
              </h3>
              <button onClick={() => setIsNewModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartWorkflow} className="p-6 space-y-4">
              {/* Project Mode Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Project Execution Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setIsGreenfield(false)}
                    className={`p-3 rounded-lg border cursor-pointer transition text-xs space-y-1 ${
                      !isGreenfield
                        ? "bg-indigo-600/15 border-indigo-500 text-indigo-100"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span>Existing Codebase</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Add feature or fix bugs in current repo</p>
                  </div>

                  <div
                    onClick={() => setIsGreenfield(true)}
                    className={`p-3 rounded-lg border cursor-pointer transition text-xs space-y-1 ${
                      isGreenfield
                        ? "bg-indigo-600/15 border-indigo-500 text-indigo-100"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                      <FolderPlus className="w-4 h-4 text-indigo-400" />
                      <span>Empty Folder Setup</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Scaffold and build new project from scratch</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Workflow Title</label>
                <Input
                  placeholder="e.g. Implement User Authentication API"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Goal & Requirements Specification</label>
                <textarea
                  className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[90px] resize-y"
                  placeholder="Describe requirements, tech stack constraints, endpoints or components..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  GitHub Remote Repository URL (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. https://github.com/fvthakor/AI-Code-Orchestrator.git"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Leave empty to use existing origin or push without gh dependencies.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setIsNewModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !title.trim() || !goal.trim()} className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? "Starting Team..." : "Start Team Workflow"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PR Result Modal */}
      <PrModal
        isOpen={isPrModalOpen}
        onClose={() => setPrModalOpen(false)}
        prResult={prResult}
        branchName={activeWorkflow?.branchName}
      />
    </div>
  );
}
