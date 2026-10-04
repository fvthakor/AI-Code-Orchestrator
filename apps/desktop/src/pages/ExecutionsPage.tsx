import { useState, useEffect } from "react";
import {
  History,
  Terminal,
  Bot,
  Copy,
  Check,
  Search,
  FileCode,
} from "lucide-react";
import { useExecutionStore } from "../stores/useExecutionStore";
import { useProjectStore } from "../stores/useProjectStore";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import type { Execution } from "@ai-orchestrator/shared-types";

export function ExecutionsPage() {
  const { currentProject } = useProjectStore();
  const { executions, loadExecutions, terminalLogs } = useExecutionStore();

  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (currentProject) {
      loadExecutions(currentProject.id);
    }
  }, [currentProject, loadExecutions]);

  useEffect(() => {
    if (executions.length > 0 && !selectedExecution) {
      setSelectedExecution(executions[0]);
    }
  }, [executions, selectedExecution]);

  const handleCopyLogs = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredExecutions = executions.filter((exec) => {
    const q = searchQuery.toLowerCase();
    return (
      exec.id.toLowerCase().includes(q) ||
      (exec.agentId && exec.agentId.toLowerCase().includes(q)) ||
      (exec.command && exec.command.toLowerCase().includes(q))
    );
  });

  if (!currentProject) {
    return (
      <div className="text-center py-16 text-slate-500 text-xs">
        Please select a project to inspect execution logs.
      </div>
    );
  }

  const activeLog =
    selectedExecution &&
    (terminalLogs[selectedExecution.id] ||
      (selectedExecution.gitDiff ? `Git Diff Recorded:\n${selectedExecution.gitDiff}` : "No live log captured for this run."));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>Execution History & Logs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Recorded CLI processes and ConPTY sessions for {currentProject.name}.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Search executions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Main Layout: List + Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[620px]">
        {/* Left Executions Table / List */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900 rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-950/60 border-b border-slate-800 font-semibold text-xs text-slate-300">
            Executions ({filteredExecutions.length})
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredExecutions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No executions recorded yet.
              </div>
            ) : (
              filteredExecutions.map((exec) => {
                const isSelected = selectedExecution?.id === exec.id;

                return (
                  <div
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec)}
                    className={`p-3.5 cursor-pointer transition text-xs space-y-1.5 ${
                      isSelected
                        ? "bg-indigo-600/15 border-l-2 border-indigo-500 text-slate-200"
                        : "hover:bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200 flex items-center space-x-1.5">
                        {exec.agentId ? (
                          <>
                            <Bot className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Agent: {exec.agentId}</span>
                          </>
                        ) : (
                          <>
                            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-mono truncate max-w-[140px]">
                              {exec.command || "Shell"}
                            </span>
                          </>
                        )}
                      </span>

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

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{new Date(exec.startedAt).toLocaleString()}</span>
                      {exec.exitCode !== undefined && (
                        <span>Exit: {exec.exitCode ?? 0}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Log Inspector */}
        <div className="lg:col-span-7 border border-slate-800 bg-slate-950 rounded-xl overflow-hidden flex flex-col">
          {selectedExecution ? (
            <>
              {/* Top metadata toolbar */}
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-mono text-slate-400">ID: {selectedExecution.id.slice(0, 8)}...</span>
                  {selectedExecution.exitCode !== undefined && (
                    <span
                      className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                        selectedExecution.exitCode === 0
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      Exit Code: {selectedExecution.exitCode}
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyLogs(activeLog || "")}
                  className="text-xs h-7 px-2 text-slate-400 hover:text-slate-200"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      <span>Copy Log</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Changed files badge if any */}
              {selectedExecution.filesChanged && selectedExecution.filesChanged.length > 0 && (
                <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center space-x-2 text-xs text-slate-400">
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Changed Files ({selectedExecution.filesChanged.length}):</span>
                  <span className="font-mono text-[11px] text-slate-300 truncate">
                    {selectedExecution.filesChanged.map((f) => f.path).join(", ")}
                  </span>
                </div>
              )}

              {/* Terminal Log Screen */}
              <div className="flex-1 p-4 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap select-all leading-relaxed bg-black/40">
                {activeLog}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Select an execution from the list to view captured logs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
