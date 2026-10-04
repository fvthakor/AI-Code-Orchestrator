import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Bot,
  Terminal,
  ShieldCheck,
  FileCode,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { useTeamStore } from "../../stores/useTeamStore";
import { useTerminalStore } from "../../stores/useTerminalStore";
import type { TeamWorkflowStep } from "@ai-orchestrator/shared-types";

interface TeamKanbanBoardProps {
  onOpenPrModal?: () => void;
}

export function TeamKanbanBoard({ onOpenPrModal }: TeamKanbanBoardProps) {
  const { activeWorkflow, steps, advanceStep, retryStep, triggerFallback } = useTeamStore();
  const { openDrawer, spawnSession } = useTerminalStore();

  if (!activeWorkflow) {
    return (
      <div className="text-center py-12 text-slate-500 text-xs">
        No active team workflow selected. Start a workflow above.
      </div>
    );
  }

  const handleRunInTerminal = () => {
    openDrawer();
    spawnSession(activeWorkflow.projectId);
  };

  const handleCompleteStep = async (step: TeamWorkflowStep) => {
    await advanceStep({
      workflowId: activeWorkflow.id,
      stepId: step.id,
      status: "completed",
      verificationReport: `Successfully verified by ${step.assignedAgentId}. Exit code 0.`,
    });
  };

  const handleFailStep = async (step: TeamWorkflowStep) => {
    await advanceStep({
      workflowId: activeWorkflow.id,
      stepId: step.id,
      status: "failed",
      errorLog: `Tests failed on ${step.testCommand || "verification run"}. Error: Assertion failure.`,
    });
  };

  const handleRetryStep = async (step: TeamWorkflowStep) => {
    await retryStep(step.id);
  };

  return (
    <div className="space-y-4">
      {/* Workflow Progress Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="font-bold text-sm text-slate-100">{activeWorkflow.title}</h3>
            <Badge
              variant={
                activeWorkflow.phase === "completed"
                  ? "success"
                  : activeWorkflow.phase === "failed"
                  ? "danger"
                  : "default"
              }
              className="text-xs uppercase"
            >
              Phase: {activeWorkflow.phase}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">{activeWorkflow.goal}</p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleRunInTerminal} className="text-xs flex items-center space-x-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Terminal</span>
          </Button>

          {activeWorkflow.phase === "reviewing" && onOpenPrModal && (
            <Button size="sm" onClick={onOpenPrModal} className="text-xs flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Submit Pull Request</span>
            </Button>
          )}
        </div>
      </div>

      {/* Sequential Pipeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, idx) => {
          const isCurrent = activeWorkflow.currentStepIndex === idx;
          const isDone = step.status === "completed";
          const isFailed = step.status === "failed";

          return (
            <div
              key={step.id}
              className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 transition ${
                isCurrent
                  ? "bg-slate-900/90 border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                  : isDone
                  ? "bg-slate-900/60 border-slate-800 opacity-90"
                  : "bg-slate-950/40 border-slate-800/80"
              }`}
            >
              <div className="space-y-3">
                {/* Step Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-mono font-bold text-slate-300">
                      {step.stepNumber}
                    </span>
                    <Badge
                      variant={isDone ? "success" : isFailed ? "danger" : isCurrent ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {step.status}
                    </Badge>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {step.retryCount > 0 && (
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Retry {step.retryCount}/3
                      </span>
                    )}

                    {step.fallbackAgentUsed && (
                      <span
                        className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center space-x-1"
                        title={`Switched to backup agent: ${step.fallbackAgentUsed}`}
                      >
                        <Zap className="w-2.5 h-2.5 text-purple-400" />
                        <span>{step.fallbackAgentUsed}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="font-semibold text-xs text-slate-200">{step.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Role & Agent Assignment */}
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 flex items-center space-x-1">
                      <Bot className="w-3 h-3 text-indigo-400" />
                      <span>Role:</span>
                    </span>
                    <span className="font-medium text-slate-300 uppercase text-[10px]">
                      {step.assignedRole.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 flex items-center space-x-1">
                      <FileCode className="w-3 h-3 text-emerald-400" />
                      <span>Agent:</span>
                    </span>
                    <span className="font-mono text-indigo-300 font-semibold text-[10px]">
                      {step.assignedAgentId}
                    </span>
                  </div>

                  {step.testCommand && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                      <span className="text-slate-500 text-[10px]">Verify Command:</span>
                      <code className="text-[10px] font-mono text-cyan-300 truncate max-w-[140px]">
                        {step.testCommand}
                      </code>
                    </div>
                  )}
                </div>

                {/* Verification Report Feedback */}
                {step.verificationReport && (
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{step.verificationReport}</span>
                  </div>
                )}

                {/* Error Log Feedback */}
                {step.errorLog && (
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-start space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{step.errorLog}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                {isCurrent && !isDone && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFailStep(step)}
                      className="text-[10px] h-7 px-2 text-rose-400 hover:text-rose-300"
                    >
                      Fail
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerFallback(step.id)}
                      className="text-[10px] h-7 px-2 text-purple-300 hover:text-purple-200 border-purple-800/60 flex items-center space-x-1"
                      title="Switch to configured backup agent if token quota is exhausted"
                    >
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span>Fallback</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleCompleteStep(step)}
                      className="text-[10px] h-7 px-2 flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500"
                    >
                      <span>Pass</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </>
                )}

                {isFailed && (
                  <div className="flex items-center space-x-1.5 w-full">
                    {step.retryCount < 3 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetryStep(step)}
                        className="flex-1 text-xs h-7 text-amber-400 hover:text-amber-300 flex items-center justify-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry ({step.retryCount}/3)</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerFallback(step.id)}
                      className="text-xs h-7 px-2 text-purple-300 hover:text-purple-200 border-purple-800/60 flex items-center justify-center space-x-1"
                      title="Switch to backup agent due to token limit"
                    >
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span>Token Fallback</span>
                    </Button>
                  </div>
                )}

                {isDone && (
                  <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Step Verified</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
