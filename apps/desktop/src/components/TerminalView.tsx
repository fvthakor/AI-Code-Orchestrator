import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Play, Square, Trash2, Bot, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "./ui/Button";
import { IpcService } from "../services/ipc";
import { useTerminalStore } from "../stores/useTerminalStore";
import { useExecutionStore } from "../stores/useExecutionStore";

export interface TerminalViewProps {
  sessionId?: string | null;
  executionId?: string | null;
  title?: string;
  className?: string;
  interactive?: boolean;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  executionId,
  title,
  className,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const activeExecutionIdFromStore = useTerminalStore((s) => s.activeExecutionId);
  const activeAgentTask = useExecutionStore((s) => s.activeAgentTask);
  const activeExecutionIdFromExecutionStore = useExecutionStore((s) => s.activeExecutionId);
  const terminalLogs = useExecutionStore((s) => s.terminalLogs);
  const spawnSession = useTerminalStore((s) => s.spawnSession);
  const killSession = useTerminalStore((s) => s.killSession);

  // Resolve target ID based on explicit prop or active state
  const effectiveExecutionId =
    executionId ||
    activeExecutionIdFromStore ||
    activeAgentTask?.executionId ||
    activeExecutionIdFromExecutionStore;

  const targetId = sessionId || effectiveExecutionId || activeSessionId;
  const isExecutionStream = Boolean(targetId && (targetId === effectiveExecutionId || executionId));

  const displayTitle =
    title ||
    (isExecutionStream
      ? activeAgentTask
        ? `Agent Stream: ${activeAgentTask.agentId} (${activeAgentTask.title})`
        : `Agent Execution Stream (${targetId?.slice(0, 8)})`
      : "PowerShell ConPTY Shell");

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: "#030712",
        foreground: "#f3f4f6",
        cursor: "#38bdf8",
        selectionBackground: "#334155",
        black: "#0f172a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#38bdf8",
        white: "#f8fafc",
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Load any existing buffered logs
    if (targetId && terminalLogs[targetId]) {
      term.write(terminalLogs[targetId]);
    } else if (isExecutionStream) {
      term.writeln(`\x1b[36m[AI Orchestrator]\x1b[0m Monitoring active agent execution stream...`);
      if (activeAgentTask) {
        term.writeln(`\x1b[90mAgent: ${activeAgentTask.agentId} | Project: ${activeAgentTask.projectName}\x1b[0m`);
        term.writeln(`\x1b[90mTask: ${activeAgentTask.title}\x1b[0m\r\n`);
      }
    }

    // Handle user keyboard input for interactive sessions
    if (interactive && targetId && !isExecutionStream) {
      term.onData((data) => {
        IpcService.terminalWrite(targetId, data).catch(() => {});
      });
    }

    // Handle resize
    const handleResize = () => {
      try {
        fitAddon.fit();
        if (targetId && !isExecutionStream) {
          IpcService.terminalResize(targetId, term.cols, term.rows).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, [interactive, targetId, isExecutionStream]);

  // Subscribe to real-time output
  useEffect(() => {
    if (!targetId || !termRef.current) return;

    let unlisten: (() => void) | undefined;
    IpcService.onTerminalOutput(targetId, (output) => {
      termRef.current?.write(output);
    }).then((un) => {
      unlisten = un;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [targetId]);

  const handleClear = () => {
    termRef.current?.clear();
  };

  const handleRestart = () => {
    termRef.current?.clear();
    spawnSession();
  };

  return (
    <div className={`flex flex-col h-full w-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden ${className || ""}`}>
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          {isExecutionStream ? (
            <Bot className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <TerminalIcon className="w-3.5 h-3.5 text-indigo-400" />
          )}
          <span className="font-mono font-medium truncate max-w-lg">{displayTitle}</span>
          {targetId && (
            <span className="text-[10px] text-slate-500 font-mono">
              ({targetId.slice(0, 8)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={handleClear} title="Clear terminal">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {!isExecutionStream && interactive && (
            <>
              <Button variant="ghost" size="sm" onClick={handleRestart} title="Restart session">
                <Play className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={killSession} title="Stop session">
                <Square className="w-3.5 h-3.5 text-rose-400" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Terminal Canvas */}
      <div ref={containerRef} className="flex-1 w-full p-2 overflow-hidden bg-slate-950" />
    </div>
  );
};
