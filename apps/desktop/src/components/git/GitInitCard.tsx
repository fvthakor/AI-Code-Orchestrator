import React, { useState } from "react";
import { GitBranch, FolderGit2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { IpcService } from "../../services/ipc";
import { useProjectStore } from "../../stores/useProjectStore";

interface GitInitCardProps {
  projectId: string;
  projectName: string;
  projectPath?: string;
}

export function GitInitCard({ projectId, projectName, projectPath }: GitInitCardProps) {
  const { analyzeProject } = useProjectStore();
  const [remoteUrl, setRemoteUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("master");
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsInitializing(true);
      setError(null);
      await IpcService.gitInitOrLink(
        projectId,
        remoteUrl.trim() || undefined,
        defaultBranch.trim() || "master"
      );
      setSuccess(true);
      await analyzeProject(projectId);
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <Card className="border-indigo-500/30 bg-slate-900/90 shadow-md h-full flex flex-col justify-between">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-100">
          <span className="flex items-center space-x-2">
            <FolderGit2 className="w-4 h-4 text-indigo-400" />
            <span>Git Repository Auto-Detection</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
            No .git Directory
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs flex-1 flex flex-col justify-between">
        <p className="text-slate-400 leading-relaxed">
          <span className="font-medium text-slate-200">{projectName}</span>{" "}
          {projectPath && <span className="font-mono text-[11px] text-slate-500 block truncate mt-0.5 mb-1">{projectPath}</span>}
          is not initialized as a Git repository.
          Initialize Git and optionally link your remote repository on GitHub to enable automated branching, diff reviews, and 3-Tier PR generation.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-start space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="flex-1 font-mono text-[11px]">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center space-x-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Git repository initialized successfully!</span>
          </div>
        )}

        <form onSubmit={handleInit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-300">
              Remote GitHub URL (Optional)
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="https://github.com/username/repository.git"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                disabled={isInitializing}
                className="text-xs font-mono bg-slate-950"
              />
            </div>
            <span className="text-[10px] text-slate-500 block">
              Leave blank for a local-only Git repository. You can connect origin later.
            </span>
          </div>

          <div className="flex items-center space-x-3 pt-1">
            <div className="w-36">
              <label className="text-[10px] font-medium text-slate-400 block mb-1">
                Default Branch
              </label>
              <Input
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                disabled={isInitializing}
                className="text-xs font-mono bg-slate-950 h-8"
              />
            </div>

            <div className="flex-1 pt-4">
              <Button
                type="submit"
                disabled={isInitializing}
                className="w-full flex items-center justify-center space-x-2 text-xs h-8 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Initializing Repository...</span>
                  </>
                ) : (
                  <>
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Initialize Git & Link Remote</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
