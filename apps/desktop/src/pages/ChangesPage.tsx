import { useState, useEffect, useCallback } from "react";
import { GitBranch, FolderOpen, RefreshCw } from "lucide-react";
import { useProjectStore } from "../stores/useProjectStore";
import { GitDiffView } from "../components/GitDiffView";
import { Button } from "../components/ui/Button";
import { IpcService } from "../services/ipc";
import type { GitContext } from "@ai-orchestrator/shared-types";

export function ChangesPage() {
  const { currentProject, selectDirectoryAndOpen } = useProjectStore();
  const [diff, setDiff] = useState<string>("");
  const [gitContext, setGitContext] = useState<GitContext | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchGitData = useCallback(async () => {
    if (!currentProject) return;
    try {
      setIsLoading(true);
      const [diffData, statusData] = await Promise.all([
        IpcService.gitDiff(currentProject.id),
        IpcService.gitStatus(currentProject.id),
      ]);
      setDiff(diffData);
      setGitContext(statusData);
    } catch (err: unknown) {
      console.error("Failed to fetch git diff/status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchGitData();
  }, [fetchGitData]);

  if (!currentProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
        <GitBranch className="w-12 h-12 text-slate-600" />
        <h2 className="text-lg font-bold text-slate-100">No Project Selected</h2>
        <p className="text-xs text-slate-400">
          Open a project to review Git status, inspect unified diffs, and commit changes.
        </p>
        <Button onClick={() => selectDirectoryAndOpen()} className="flex items-center space-x-2">
          <FolderOpen className="w-4 h-4" />
          <span>Open Project</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            <span>Git Changes & Unified Diff</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Project: {currentProject.name} ({gitContext?.branch || currentProject.git?.branch || "HEAD"})
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchGitData}
          disabled={isLoading}
          className="flex items-center space-x-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      <div className="flex-1 min-h-[500px]">
        <GitDiffView
          diff={diff}
          modifiedFiles={gitContext?.modifiedFiles || currentProject.git?.modifiedFiles}
          addedFiles={gitContext?.addedFiles || currentProject.git?.addedFiles}
          deletedFiles={gitContext?.deletedFiles || currentProject.git?.deletedFiles}
          untrackedFiles={gitContext?.untrackedFiles || currentProject.git?.untrackedFiles}
          onRefresh={fetchGitData}
        />
      </div>
    </div>
  );
}
