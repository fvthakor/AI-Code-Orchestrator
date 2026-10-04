import { useState } from "react";
import { GitPullRequest, ExternalLink, Copy, Check, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import type { GitHubPrResult } from "@ai-orchestrator/shared-types";

interface PrModalProps {
  isOpen: boolean;
  onClose: () => void;
  prResult: GitHubPrResult | null;
  branchName?: string;
}

export function PrModal({ isOpen, onClose, prResult, branchName }: PrModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !prResult) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(prResult.prUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBrowser = () => {
    window.open(prResult.prUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                {prResult.isWebFallback ? "Pull Request Ready to Submit" : "Pull Request Created"}
              </h3>
              <span className="text-xs text-slate-400">
                Branch: <code className="font-mono text-indigo-300">{branchName || "feature"}</code>
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Creation Method:</span>
            <Badge
              variant={prResult.method === "api" ? "success" : prResult.method === "cli" ? "default" : "warning"}
              className="text-xs uppercase font-mono"
            >
              {prResult.method === "api"
                ? "GitHub REST API"
                : prResult.method === "cli"
                ? "GitHub CLI (gh)"
                : "Direct Web Link (Zero Dependencies)"}
            </Badge>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {prResult.isWebFallback
              ? "Your branch has been pushed to GitHub. Click below to open GitHub with the Title, Description, and Diff already pre-filled and ready to submit with one click!"
              : "Your Pull Request has been opened on GitHub. Reviewers can now inspect the code changes and test verifications."}
          </p>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              PR Link
            </span>
            <div className="text-xs font-mono text-indigo-300 truncate select-all">
              {prResult.prUrl}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <Button variant="outline" size="sm" onClick={handleCopy} className="flex items-center space-x-1.5">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy URL"}</span>
            </Button>

            <Button size="sm" onClick={handleOpenBrowser} className="flex items-center space-x-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{prResult.isWebFallback ? "Open Pull Request on GitHub" : "View on GitHub"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
