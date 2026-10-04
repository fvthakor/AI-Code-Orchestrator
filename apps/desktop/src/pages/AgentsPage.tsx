import React, { useState } from "react";
import {
  Bot,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Terminal,
  FolderGit2,
  Settings2,
  Save,
  X,
} from "lucide-react";
import { useAgentStore } from "../stores/useAgentStore";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import type { AgentInfo } from "@ai-orchestrator/shared-types";

export function AgentsPage() {
  const { agents, detectAll, saveConfig, testConnection, isLoading } = useAgentStore();

  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentInfo | null>(null);
  const [customPathInput, setCustomPathInput] = useState<string>("");
  const [enabledInput, setEnabledInput] = useState<boolean>(true);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(
    null
  );

  const handleTest = async (agentId: string) => {
    try {
      setTestingId(agentId);
      setTestResult(null);
      const res = await testConnection(agentId);
      if (res && res.status === "connected") {
        setTestResult({
          id: agentId,
          success: true,
          msg: `Successfully connected to ${res.name} (v${res.version || "unknown"}). Ready for orchestration!`,
        });
      } else {
        setTestResult({
          id: agentId,
          success: false,
          msg: `CLI executable not responding or not found in system PATH.`,
        });
      }
    } catch (err: unknown) {
      setTestResult({
        id: agentId,
        success: false,
        msg: `Connection test error: ${String(err)}`,
      });
    } finally {
      setTestingId(null);
    }
  };

  const openSettings = (agent: AgentInfo) => {
    setEditingAgent(agent);
    setCustomPathInput(agent.executablePath || "");
    setEnabledInput(agent.enabled);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    await saveConfig(
      editingAgent.id,
      editingAgent.name,
      enabledInput,
      customPathInput.trim() || undefined
    );

    setEditingAgent(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">AI Coding Agents</h2>
          <p className="text-xs text-slate-400 mt-1">
            Windows CLI adapter configurations for local coding agents.
          </p>
        </div>

        <Button
          onClick={() => detectAll()}
          disabled={isLoading}
          className="flex items-center space-x-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>Rescan All Agents</span>
        </Button>
      </div>

      {/* Test feedback toast / banner */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 text-xs animate-in fade-in ${
            testResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-200"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">
              {testResult.success ? "Agent Connected" : "Connection Failed"}
            </span>
            <span>{testResult.msg}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {agents.map((agent) => {
          const isInstalled = agent.status === "connected";
          const isTesting = testingId === agent.id;

          return (
            <div
              key={agent.id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-100">{agent.name}</h3>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {agent.id}</span>
                    </div>
                  </div>
                  <Badge variant={isInstalled ? "success" : "warning"} className="text-[10px]">
                    {agent.status}
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Executable Location
                  </span>
                  <p
                    className="text-xs font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 truncate"
                    title={agent.executablePath || "Not Found"}
                  >
                    {agent.executablePath || "Executable not detected in PATH"}
                  </p>
                </div>

                {agent.version && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Detected Version:</span>
                    <span className="font-mono text-slate-200">v{agent.version}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    Capabilities
                  </span>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center space-x-2">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Code & File Editing:</span>
                      <span className="font-mono text-[11px] text-slate-400 ml-auto">
                        {agent.capabilities?.fileEditing ? "Supported" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>ConPTY Shell Commands:</span>
                      <span className="font-mono text-[11px] text-slate-400 ml-auto">
                        {agent.capabilities?.terminal ? "Supported" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Git Operations & Diff:</span>
                      <span className="font-mono text-[11px] text-slate-400 ml-auto">
                        {agent.capabilities?.git ? "Supported" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isTesting}
                  onClick={() => handleTest(agent.id)}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  {isTesting ? "Testing..." : "Test Connection"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSettings(agent)}
                  className="text-xs flex items-center space-x-1"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Configure</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Agent Settings Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100">
                Configure {editingAgent.name} Adapter
              </h3>
              <button
                onClick={() => setEditingAgent(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Custom Executable Override Path
                </label>
                <Input
                  type="text"
                  placeholder="e.g. C:\Users\Username\AppData\Roaming\npm\claude.cmd"
                  value={customPathInput}
                  onChange={(e) => setCustomPathInput(e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Leave empty to use automatic Windows PATH resolution.
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enabledInput}
                    onChange={(e) => setEnabledInput(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Enable this agent adapter for task execution
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setEditingAgent(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
