import React, { useState } from "react";
import { FileCode, FilePlus, FileMinus, FileQuestion, Check, GitCommit } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Input } from "./ui/Input";
import { IpcService } from "../services/ipc";
import { useProjectStore } from "../stores/useProjectStore";

export interface GitDiffViewProps {
  diff: string;
  modifiedFiles?: string[];
  addedFiles?: string[];
  deletedFiles?: string[];
  untrackedFiles?: string[];
  onRefresh?: () => void;
}

export const GitDiffView: React.FC<GitDiffViewProps> = ({
  diff,
  modifiedFiles = [],
  addedFiles = [],
  deletedFiles = [],
  untrackedFiles = [],
  onRefresh,
}) => {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [filterFile, setFilterFile] = useState<string | null>(null);

  const totalFiles =
    modifiedFiles.length + addedFiles.length + deletedFiles.length + untrackedFiles.length;

  const handleCommit = async () => {
    if (!currentProject || !commitMessage.trim()) return;
    try {
      setIsCommitting(true);
      await IpcService.gitCommit(currentProject.id, { message: commitMessage });
      setCommitMessage("");
      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 3000);
      onRefresh?.();
    } catch (err: unknown) {
      alert(`Commit failed: ${String(err)}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Render unified diff lines with syntax highlighting
  const renderDiffLines = () => {
    if (!diff.trim()) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-sm">
          <FileCode className="w-8 h-8 mb-2 opacity-50" />
          <p>No changes detected in working tree.</p>
        </div>
      );
    }

    const lines = diff.split("\n");
    return (
      <pre className="font-mono text-xs leading-5 p-4 overflow-x-auto select-text">
        {lines.map((line, idx) => {
          let lineStyle = "text-slate-400";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineStyle = "bg-emerald-950/60 text-emerald-300 block -mx-4 px-4 border-l-2 border-emerald-500";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineStyle = "bg-rose-950/60 text-rose-300 block -mx-4 px-4 border-l-2 border-rose-500";
          } else if (line.startsWith("@@")) {
            lineStyle = "text-sky-400 font-semibold block py-1 mt-1 border-t border-slate-800 text-[11px]";
          } else if (line.startsWith("diff --git")) {
            lineStyle = "text-amber-400 font-bold block pt-2 text-[12px]";
          }

          return (
            <div key={idx} className={lineStyle}>
              {line || " "}
            </div>
          );
        })}
      </pre>
    );
  };

  return (
    <div className="flex h-full w-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      {/* Changed Files Sidebar */}
      <div className="w-72 border-r border-slate-800 bg-slate-900/40 flex flex-col">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Changed Files ({totalFiles})
          </span>
          {filterFile && (
            <button
              onClick={() => setFilterFile(null)}
              className="text-[11px] text-sky-400 hover:underline"
            >
              Show all
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {modifiedFiles.map((file) => (
            <div
              key={file}
              onClick={() => setFilterFile(file)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                filterFile === file ? "bg-slate-800 text-white" : "hover:bg-slate-850 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{file}</span>
              </div>
              <Badge variant="warning">M</Badge>
            </div>
          ))}

          {addedFiles.map((file) => (
            <div
              key={file}
              onClick={() => setFilterFile(file)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                filterFile === file ? "bg-slate-800 text-white" : "hover:bg-slate-850 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FilePlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{file}</span>
              </div>
              <Badge variant="success">A</Badge>
            </div>
          ))}

          {deletedFiles.map((file) => (
            <div
              key={file}
              onClick={() => setFilterFile(file)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                filterFile === file ? "bg-slate-800 text-white" : "hover:bg-slate-850 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileMinus className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{file}</span>
              </div>
              <Badge variant="danger">D</Badge>
            </div>
          ))}

          {untrackedFiles.map((file) => (
            <div
              key={file}
              onClick={() => setFilterFile(file)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                filterFile === file ? "bg-slate-800 text-white" : "hover:bg-slate-850 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileQuestion className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{file}</span>
              </div>
              <Badge variant="secondary">?</Badge>
            </div>
          ))}

          {totalFiles === 0 && (
            <p className="text-xs text-slate-500 p-3 text-center">Working directory clean</p>
          )}
        </div>

        {/* Quick Commit Box */}
        {totalFiles > 0 && (
          <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-900/60">
            <Input
              placeholder="Commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              disabled={!commitMessage.trim()}
              isLoading={isCommitting}
              onClick={handleCommit}
            >
              {commitSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-300" /> Committed!
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5 mr-1" /> Commit Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Diff Viewer Canvas */}
      <div className="flex-1 overflow-y-auto bg-slate-950">{renderDiffLines()}</div>
    </div>
  );
};
