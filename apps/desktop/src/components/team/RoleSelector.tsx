import { useState } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useTeamStore } from "../../stores/useTeamStore";
import {
  Bot,
  ShieldAlert,
  GitPullRequest,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Save,
  Check,
} from "lucide-react";
import { Button } from "../ui/Button";

interface RoleCardProps {
  title: string;
  roleSubtitle: string;
  description: string;
  role: "plan_manager" | "developer" | "tester";
  titleColor: string;
}

function RoleCard({
  title,
  roleSubtitle,
  description,
  role,
  titleColor,
}: RoleCardProps) {
  const { agents } = useAgentStore();
  const {
    config,
    addAgentToRole,
    removeAgentFromRole,
    moveAgentInRole,
    setAgentAtRoleIndex,
  } = useTeamStore();

  const field =
    role === "plan_manager"
      ? "planManagerAgents"
      : role === "developer"
      ? "developerAgents"
      : "testerAgents";

  const agentIds = config[field] || [];
  const showSort = agentIds.length > 1;

  const handleAddMore = () => {
    // Pick first agent not yet in the list, or fallback to first available agent
    const unused = agents.find((a) => !agentIds.includes(a.id));
    if (unused) {
      addAgentToRole(role, unused.id);
    } else if (agents.length > 0) {
      addAgentToRole(role, agents[0].id);
    }
  };

  return (
    <div className="space-y-2.5 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-1">
          <span className={`text-xs font-semibold ${titleColor}`}>{title}</span>
          <span className="text-[10px] text-slate-500 uppercase font-mono">{roleSubtitle}</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-snug mb-2.5">{description}</p>

        {/* Empty state: show blank if none added */}
        {agentIds.length === 0 ? (
          <div className="py-4 px-3 rounded-lg border border-dashed border-slate-800 text-center space-y-2">
            <span className="text-[11px] text-slate-500 block">No agent assigned</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddMore}
              className="text-xs h-7 px-2.5 text-indigo-400 hover:text-indigo-300 border-slate-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add Agent</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {agentIds.map((agentId, index) => {
              const isPrimary = index === 0;
              const canMoveUp = index > 0;
              const canMoveDown = index < agentIds.length - 1;

              return (
                <div
                  key={index}
                  className={`flex items-center space-x-1.5 p-1.5 rounded-lg border transition ${
                    isPrimary
                      ? "bg-slate-900 border-indigo-500/40 shadow-sm shadow-indigo-500/5"
                      : "bg-slate-950 border-slate-800/90"
                  }`}
                >
                  {/* Dynamic Role Badge: #1 Primary or #N Fallback */}
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                      isPrimary
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700/60"
                    }`}
                  >
                    {isPrimary ? "#1 Primary" : `#${index + 1} Fallback`}
                  </span>

                  {/* Agent Selector Dropdown */}
                  <select
                    value={agentId}
                    onChange={(e) => setAgentAtRoleIndex(role, index, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-xs text-slate-200 focus:outline-none truncate py-0.5"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200">
                        {a.name} ({a.status})
                      </option>
                    ))}
                  </select>

                  {/* Sort Order Controls (Only shown if multiple agents exist) */}
                  {showSort && (
                    <div className="flex items-center space-x-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={!canMoveUp}
                        onClick={() => moveAgentInRole(role, index, index - 1)}
                        className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition"
                        title="Move Up (Promote)"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canMoveDown}
                        onClick={() => moveAgentInRole(role, index, index + 1)}
                        className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition"
                        title="Move Down (Demote)"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Remove Agent */}
                  <button
                    type="button"
                    onClick={() => removeAgentFromRole(role, index)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition shrink-0"
                    title="Remove from role"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add More Button (Only if there are items, or to chain more fallbacks) */}
      {agentIds.length > 0 && (
        <button
          type="button"
          onClick={handleAddMore}
          className="w-full mt-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 border border-dashed border-slate-800 hover:border-slate-700 rounded-lg flex items-center justify-center space-x-1 transition"
        >
          <Plus className="w-3 h-3" />
          <span>Add More</span>
        </button>
      )}
    </div>
  );
}

export function RoleSelector() {
  const { config, setConfig, saveConfig } = useTeamStore();
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    saveConfig();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2500);
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>Autonomous Team Roles Configuration</span>
        </h3>
        <div className="flex items-center space-x-3">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">Priority Cascade & Fallbacks</span>
          <Button
            size="sm"
            onClick={handleSave}
            className={`flex items-center space-x-1.5 text-xs h-7 px-2.5 transition shadow-sm ${
              isSaved
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Saved Globally!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Team Setup</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plan Manager */}
        <RoleCard
          title="📋 Plan Manager"
          roleSubtitle="Architect"
          description="Breaks project goals into sequential atomic tasks & reviews diffs."
          role="plan_manager"
          titleColor="text-indigo-300"
        />

        {/* Developer */}
        <RoleCard
          title="💻 Developer"
          roleSubtitle="Builder"
          description="Implements code changes for one scoped task at a time."
          role="developer"
          titleColor="text-emerald-300"
        />

        {/* QA Tester */}
        <RoleCard
          title="🧪 QA Tester"
          roleSubtitle="Verification"
          description="Executes builds, linters & tests to verify zero regressions."
          role="tester"
          titleColor="text-cyan-300"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Max QA Auto-Retries:</span>
          <select
            value={config.maxRetries}
            onChange={(e) => setConfig({ maxRetries: parseInt(e.target.value) || 3 })}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs"
          >
            <option value={1}>1 Attempt</option>
            <option value={2}>2 Attempts</option>
            <option value={3}>3 Attempts (Recommended)</option>
          </select>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.autoPr}
              onChange={(e) => setConfig({ autoPr: e.target.checked })}
              className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 rounded"
            />
            <span className="flex items-center space-x-1">
              <GitPullRequest className="w-3.5 h-3.5 text-indigo-400" />
              <span>Auto-create Pull Request on workflow completion</span>
            </span>
          </label>

          <Button
            size="sm"
            onClick={handleSave}
            className={`flex items-center space-x-1.5 text-xs h-8 px-3.5 transition shadow-sm ${
              isSaved
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Saved Globally!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Configuration</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
