import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Play, Square, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { IpcService } from "../services/ipc";
import { useTerminalStore } from "../stores/useTerminalStore";

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
  title = "Terminal Session",
  className,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const spawnSession = useTerminalStore((s) => s.spawnSession);
  const killSession = useTerminalStore((s) => s.killSession);

  const targetId = sessionId || executionId || activeSessionId;

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

    // Handle user keyboard input
    if (interactive && targetId) {
      term.onData((data) => {
        IpcService.terminalWrite(targetId, data).catch(() => {});
      });
    }

    // Handle resize
    const handleResize = () => {
      try {
        fitAddon.fit();
        if (targetId) {
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
  }, [interactive, targetId]);

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
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono font-medium">{title}</span>
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
          {interactive && (
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
