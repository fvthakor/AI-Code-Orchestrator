import { useAgentStore } from "../../stores/useAgentStore";
import { useTeamStore } from "../../stores/useTeamStore";
import { Bot, ShieldAlert, GitPullRequest } from "lucide-react";

export function RoleSelector() {
  const { agents } = useAgentStore();
  const { config, setConfig } = useTeamStore();

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>Autonomous Team Roles Configuration</span>
        </h3>
        <span className="text-[11px] text-slate-500 font-mono">Multi-Agent State Machine</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plan Manager */}
        <div className="space-y-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-300">📋 Plan Manager</span>
            <span className="text-[10px] text-slate-500">Architect</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Breaks project goals into sequential atomic tasks & reviews diffs.
          </p>
          <div>
            <span className="text-[10px] text-slate-400">Primary:</span>
            <select
              value={config.planManagerAgentId}
              onChange={(e) => setConfig({ planManagerAgentId: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-0.5"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
          <div className="pt-1.5 border-t border-slate-900">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Token Fallback:</span>
              <span className="text-[9px] text-amber-400/80">Rate-limit backup</span>
            </div>
            <select
              value={config.planManagerFallbackAgentId || ""}
              onChange={(e) => setConfig({ planManagerFallbackAgentId: e.target.value || undefined })}
              className="w-full px-2 py-1 text-[11px] bg-slate-900/90 border border-slate-800 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-0.5"
            >
              <option value="">None (No fallback)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Developer */}
        <div className="space-y-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300">💻 Developer</span>
            <span className="text-[10px] text-slate-500">Builder</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Implements code changes for one scoped task at a time.
          </p>
          <div>
            <span className="text-[10px] text-slate-400">Primary:</span>
            <select
              value={config.developerAgentId}
              onChange={(e) => setConfig({ developerAgentId: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 mt-0.5"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
          <div className="pt-1.5 border-t border-slate-900">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Token Fallback:</span>
              <span className="text-[9px] text-amber-400/80">Rate-limit backup</span>
            </div>
            <select
              value={config.developerFallbackAgentId || ""}
              onChange={(e) => setConfig({ developerFallbackAgentId: e.target.value || undefined })}
              className="w-full px-2 py-1 text-[11px] bg-slate-900/90 border border-slate-800 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 mt-0.5"
            >
              <option value="">None (No fallback)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* QA Tester */}
        <div className="space-y-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300">🧪 QA Tester</span>
            <span className="text-[10px] text-slate-500">Verification</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Executes builds, linters & tests to verify zero regressions.
          </p>
          <div>
            <span className="text-[10px] text-slate-400">Primary:</span>
            <select
              value={config.testerAgentId}
              onChange={(e) => setConfig({ testerAgentId: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 mt-0.5"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
          <div className="pt-1.5 border-t border-slate-900">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Token Fallback:</span>
              <span className="text-[9px] text-amber-400/80">Rate-limit backup</span>
            </div>
            <select
              value={config.testerFallbackAgentId || ""}
              onChange={(e) => setConfig({ testerFallbackAgentId: e.target.value || undefined })}
              className="w-full px-2 py-1 text-[11px] bg-slate-900/90 border border-slate-800 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 mt-0.5"
            >
              <option value="">None (No fallback)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>
        </div>
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
      </div>
    </div>
  );
}
