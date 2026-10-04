import React, { useState } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  Bot,
  GitBranch,
  History,
  Settings,
  Terminal,
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  FolderGit2,
  Heart,
  Coffee,
  Users,
} from "lucide-react";
import { useProjectStore } from "../stores/useProjectStore";
import { useTerminalStore } from "../stores/useTerminalStore";
import { useAgentStore } from "../stores/useAgentStore";
import { TerminalView } from "../components/TerminalView";
import { CommandPalette } from "../components/CommandPalette";
import { NewTaskModal } from "../components/NewTaskModal";
import { SecurityApprovalModal } from "../components/SecurityApprovalModal";
import { Button } from "../components/ui/Button";

export type NavPage =
  | "dashboard"
  | "team"
  | "projects"
  | "tasks"
  | "agents"
  | "changes"
  | "executions"
  | "settings";

interface AppLayoutProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  children: React.ReactNode;
}

export function AppLayout({ currentPage, onNavigate, children }: AppLayoutProps) {
  const { currentProject, selectDirectoryAndOpen } = useProjectStore();
  const { agents } = useAgentStore();
  const { isOpen: isTerminalOpen, toggleDrawer, activeSessionId } = useTerminalStore();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState<number>(320);

  const readyAgentsCount = agents.filter((a) => a.status === "connected" && a.enabled).length;

  const navItems: { id: NavPage; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "team", label: "Autonomous Team", icon: <Users className="w-4 h-4 text-indigo-400" /> },
    { id: "projects", label: "Projects", icon: <FolderOpen className="w-4 h-4" /> },
    { id: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4" /> },
    { id: "agents", label: "AI Agents", icon: <Bot className="w-4 h-4" /> },
    { id: "changes", label: "Git & Changes", icon: <GitBranch className="w-4 h-4" /> },
    { id: "executions", label: "Executions", icon: <History className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col shrink-0">
        {/* App Logo & Branding */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">
              AI Orchestrator
            </h1>
            <span className="text-[10px] text-indigo-400 font-mono tracking-wider">
              WINDOWS V1
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                <span className={isActive ? "text-indigo-400" : "text-slate-400"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Current Project Card in Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          {currentProject ? (
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Active Project
                </span>
                <button
                  onClick={() => selectDirectoryAndOpen()}
                  title="Switch Project"
                  className="text-slate-400 hover:text-slate-200 transition"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="font-semibold text-xs text-slate-200 truncate" title={currentProject.name}>
                {currentProject.name}
              </div>
              <div
                className="text-[11px] font-mono text-slate-400 truncate"
                title={currentProject.path}
              >
                {currentProject.path}
              </div>
            </div>
          ) : (
            <button
              onClick={() => selectDirectoryAndOpen()}
              className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60 transition"
            >
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              <span>Open Local Folder</span>
            </button>
          )}

          {/* Quick Terminal Button in Sidebar */}
          <button
            onClick={toggleDrawer}
            className={`w-full mt-2 flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono transition border ${
              isTerminalOpen
                ? "bg-slate-800 text-cyan-300 border-cyan-500/30"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800"
            }`}
          >
            <span className="flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>ConPTY Shell</span>
            </span>
            <kbd className="text-[10px] text-slate-500">Ctrl+`</kbd>
          </button>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4 min-w-0">
            {currentProject ? (
              <div className="flex items-center space-x-3 truncate">
                <span className="font-semibold text-sm text-slate-200 truncate">
                  {currentProject.name}
                </span>
                {currentProject.git?.branch && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-indigo-300">
                    <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{currentProject.git.branch}</span>
                  </span>
                )}
                {currentProject.git?.isClean !== undefined && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      currentProject.git.isClean
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {currentProject.git.isClean ? "Clean" : "Modified"}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">No project opened</span>
            )}
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Command Palette Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Search commands...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 border border-slate-800 rounded text-slate-500">
                Ctrl+Shift+P
              </kbd>
            </button>

            {/* Ready Agents Badge */}
            <div
              onClick={() => onNavigate("agents")}
              className="cursor-pointer flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 hover:bg-indigo-500/20 transition"
              title="Click to view installed AI agents"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {readyAgentsCount}/{agents.length} Agents Ready
              </span>
            </div>

            {/* Security Guard Indicator */}
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300"
              title="Path Traversal & Win32 Job Object Guard Active"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Guarded</span>
            </div>

            {/* Buy Me a Coffee Button */}
            <a
              href="https://www.buymeacoffee.com/fvthakor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40 transition select-none cursor-pointer"
              title="Support creator on Buy Me a Coffee"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium hidden md:inline">Buy Coffee</span>
            </a>

            {/* Sponsor Button */}
            <a
              href="https://github.com/sponsors/fvthakor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-xs text-pink-300 hover:bg-pink-500/20 hover:border-pink-500/40 transition select-none cursor-pointer"
              title="Sponsor this project on GitHub Sponsors"
            >
              <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400/30" />
              <span className="font-medium hidden sm:inline">Sponsor</span>
            </a>

            {/* Create Task Button */}
            <Button
              size="sm"
              onClick={() => setIsNewTaskModalOpen(true)}
              className="flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 min-h-0">
          {children}
        </main>

        {/* Collapsible Bottom ConPTY Terminal Drawer */}
        <div
          className={`border-t border-slate-800 bg-slate-950 flex flex-col transition-all duration-200 shrink-0 ${
            isTerminalOpen ? "" : "h-9"
          }`}
          style={{ height: isTerminalOpen ? `${terminalHeight}px` : "36px" }}
        >
          {/* Terminal Drawer Header Bar */}
          <div
            className="h-9 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none text-xs text-slate-300 hover:bg-slate-900 transition"
            onClick={toggleDrawer}
          >
            <div className="flex items-center space-x-2.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-200">Terminal</span>
              <span className="text-slate-500 font-mono text-[11px]">
                PowerShell (Windows ConPTY)
              </span>
              {activeSessionId && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Live
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              {isTerminalOpen && (
                <div className="flex items-center space-x-1 mr-2">
                  <button
                    onClick={() => setTerminalHeight((h) => Math.max(180, h - 60))}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title="Decrease height"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setTerminalHeight((h) => Math.min(600, h + 60))}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title="Increase height"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={toggleDrawer}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                {isTerminalOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Terminal Content (Mount only when open or keep active) */}
          {isTerminalOpen && (
            <div className="flex-1 min-h-0 bg-slate-950">
              <TerminalView />
            </div>
          )}
        </div>
      </div>

      {/* Global Modals */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(page) => onNavigate(page as NavPage)}
        onOpenNewTask={() => setIsNewTaskModalOpen(true)}
      />

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onTaskStarted={() => {
          // Open terminal drawer when a task starts running
          useTerminalStore.getState().openDrawer();
          onNavigate("tasks");
        }}
      />

      <SecurityApprovalModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        onApprove={() => setIsSecurityModalOpen(false)}
        command=""
      />
    </div>
  );
}
