import { AlertTriangle, ShieldAlert, CheckCircle2, X } from "lucide-react";
import { Button } from "./ui/Button";

interface SecurityApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  command: string;
  riskLevel?: "Low" | "Medium" | "High" | "Critical";
  reasons?: string[];
  targetDirectory?: string;
}

export function SecurityApprovalModal({
  isOpen,
  onClose,
  onApprove,
  command,
  riskLevel = "High",
  reasons = ["Command matches sensitive or potentially destructive system pattern"],
  targetDirectory,
}: SecurityApprovalModalProps) {
  if (!isOpen) return null;

  const isCritical = riskLevel === "Critical" || riskLevel === "High";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              {isCritical ? <ShieldAlert className="w-6 h-6 text-rose-400" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Security Approval Required
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                    isCritical
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {riskLevel} Risk
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                A process requested execution of a guarded system command.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Command to Execute
            </label>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto break-all select-all">
              {command}
            </div>
          </div>

          {targetDirectory && (
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Target Working Directory
              </label>
              <p className="text-xs font-mono text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800">
                {targetDirectory}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Policy Flags & Warnings
            </label>
            <div className="space-y-1.5">
              {reasons.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start space-x-2 text-xs text-amber-200 bg-amber-500/10 p-2 rounded border border-amber-500/20"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            By approving this command, you grant permission to run it directly inside the target
            project workspace under your Windows user account privileges.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-slate-950/60 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            Block & Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onApprove();
              onClose();
            }}
            className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve & Run</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
