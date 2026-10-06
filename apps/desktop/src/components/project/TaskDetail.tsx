import { useState } from "react";
import type { Execution, Task } from "@ai-orchestrator/shared-types";
import type { TimelineEvent } from "../../stores/useAutopilotStore";

interface TaskDetailProps {
  task: Task;
  /** Agent runs for this task, newest first */
  executions: Execution[];
  /** Timeline events for this task from the current autopilot session */
  timeline: TimelineEvent[];
  /** Terminal output by execution id */
  logs: Record<string, string>;
}

/** Last non-empty line of a log, colors removed, cut to a readable length. */
function lastLine(log: string | undefined): string {
  if (!log) return "";
  const clean = log.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? "";
  return last.length > 160 ? `${last.slice(0, 157)}...` : last;
}

/** One sentence that says where the task stands. */
function summarize(task: Task, executions: Execution[], logs: Record<string, string>): string {
  const latest = executions[0];
  if (task.status === "running") return "Running now.";
  if (task.status === "awaiting_qa") return "Developer finished. Use Send to QA to check and open a PR.";
  if (task.status === "completed") return "Done.";
  if (task.status === "failed") {
    const reason = latest ? lastLine(logs[latest.id]) : "";
    const code = latest?.exitCode !== undefined ? ` (exit code ${latest.exitCode})` : "";
    return reason ? `Failed${code}: ${reason}` : `Failed${code}. Open details for the log.`;
  }
  return "Waiting to start.";
}

export function TaskDetail({ task, executions, timeline, logs }: TaskDetailProps) {
  const [showRaw, setShowRaw] = useState(false);
  const latest = executions[0];
  const rawLines = latest ? (logs[latest.id] ?? "").split(/\r?\n/).slice(-40).join("\n") : "";

  return (
    <div className="ml-3 p-3 rounded-lg bg-slate-900/80 border border-slate-700 space-y-2.5 text-xs">
      <div className="text-slate-200">
        <span className="text-slate-500 mr-1.5">Summary:</span>
        {summarize(task, executions, logs)}
      </div>

      {timeline.length > 0 && (
        <ol className="space-y-0.5 text-[11px] text-slate-300">
          {timeline.slice(-10).map((event, idx) => (
            <li key={`${event.time}-${idx}`} className="flex gap-2">
              <span className="font-mono text-slate-500 shrink-0">{event.time}</span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      )}

      {executions.length === 0 ? (
        <div className="text-slate-500">No agent runs yet for this task.</div>
      ) : (
        <ul className="space-y-1">
          {executions.map((exec, idx) => (
            <li key={exec.id} className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono">
              <span className="text-slate-400">Run {executions.length - idx}</span>
              <span className={exec.status === "failed" ? "text-rose-400" : exec.status === "completed" ? "text-emerald-400" : "text-sky-400"}>
                {exec.status}
              </span>
              <span className="text-slate-400">exit {exec.exitCode ?? "-"}</span>
              <span className="text-slate-500">{new Date(exec.startedAt).toLocaleTimeString()}</span>
              <span className="text-slate-300 truncate max-w-full">{lastLine(logs[exec.id])}</span>
            </li>
          ))}
        </ul>
      )}

      {latest && (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-[11px] text-indigo-300 hover:text-indigo-200"
          >
            {showRaw ? "Hide raw log" : "Show raw log (last 40 lines)"}
          </button>
          {showRaw && (
            <pre className="mt-1.5 p-2 rounded bg-slate-950 text-[10px] text-slate-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {rawLines || "(no output)"}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
