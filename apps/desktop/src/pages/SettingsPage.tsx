import {
  Settings,
  Shield,
  Terminal,
  FolderLock,
  Heart,
} from "lucide-react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { Input } from "../components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>Application Settings</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure security policy guards, terminal appearance, and Windows process execution.
        </p>
      </div>

      <div className="space-y-6">
        {/* Security & Permissions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center space-x-2 text-slate-200">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Security & Command Policy</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 block">
                  Require Confirmation for High-Risk Commands
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Prompts an approval dialog when an AI agent requests potentially destructive
                  commands (e.g. disk wipes, root directory operations, database drops).
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.requireApprovalForHighRisk}
                onChange={(e) =>
                  updateSettings({ requireApprovalForHighRisk: e.target.checked })
                }
                className="w-4 h-4 mt-1 text-indigo-600 bg-slate-950 border-slate-700 rounded focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 block">
                  Path Traversal & Windows Job Object Enforcement
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Canonicalizes all file targets and enforces Win32 Job Object containment to kill
                  rogue child processes on session exit.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                Always Enforced
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Terminal Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center space-x-2 text-slate-200">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Windows ConPTY Terminal Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Default Windows Shell
                </label>
                <select
                  value={settings.defaultShell}
                  onChange={(e) => updateSettings({ defaultShell: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="powershell">Windows PowerShell (powershell.exe)</option>
                  <option value="pwsh">PowerShell 7 (pwsh.exe)</option>
                  <option value="cmd">Windows Command Prompt (cmd.exe)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Terminal Font Size (px)
                </label>
                <Input
                  type="number"
                  min={10}
                  max={24}
                  value={settings.terminalFontSize}
                  onChange={(e) =>
                    updateSettings({ terminalFontSize: parseInt(e.target.value) || 13 })
                  }
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <input
                type="checkbox"
                checked={settings.terminalCursorBlink}
                onChange={(e) => updateSettings({ terminalCursorBlink: e.target.checked })}
                className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 rounded focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-300">Terminal Cursor Blinking</span>
            </div>
          </CardContent>
        </Card>

        {/* Local Storage & Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center space-x-2 text-slate-200">
              <FolderLock className="w-4 h-4 text-purple-400" />
              <span>Local Storage & Database</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              All project definitions, task records, and execution logs are stored locally inside
              embedded SQLite at <code className="text-indigo-300">%APPDATA%\com.ai.orchestrator.desktop\orchestrator.db</code>. No sensitive API keys or credentials are saved.
            </p>
          </CardContent>
        </Card>

        {/* Sponsorship & Community Support */}
        <Card className="border-pink-500/20 bg-pink-500/[0.03]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-200">
              <span className="flex items-center space-x-2">
                <Heart className="w-4 h-4 text-pink-400 fill-pink-400/20" />
                <span>Support & Sponsorship</span>
              </span>
              <a
                href="https://github.com/sponsors/fvthakor"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-pink-600 text-white font-medium text-xs hover:bg-pink-500 transition shadow-sm select-none"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>Sponsor on GitHub</span>
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              AI Code Orchestrator is open-source and free for developers. If this tool saves you time or boosts your workflow, consider sponsoring the project on GitHub to support active development, bug fixes, and new AI agent adapters.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
