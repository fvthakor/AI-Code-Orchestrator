import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  FolderOpen,
  PlusCircle,
  Terminal,
  Bot,
  GitBranch,
  Settings,
  RefreshCw,
  Play,
  X,
} from "lucide-react";
import { useProjectStore } from "../stores/useProjectStore";
import { useTerminalStore } from "../stores/useTerminalStore";
import { useAgentStore } from "../stores/useAgentStore";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Action" | "Projects";
  icon: React.ReactNode;
  shortcut?: string;
  perform: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onOpenNewTask: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewTask,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { currentProject, projects, selectDirectoryAndOpen, openProject, analyzeProject } =
    useProjectStore();
  const { toggleDrawer, spawnSession } = useTerminalStore();
  const { detectAll } = useAgentStore();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      {
        id: "new-task",
        title: "Create New Task",
        category: "Action",
        icon: <PlusCircle className="w-4 h-4 text-emerald-400" />,
        shortcut: "Ctrl+Shift+T",
        perform: () => {
          onClose();
          onOpenNewTask();
        },
      },
      {
        id: "open-folder",
        title: "Open Local Project...",
        category: "Action",
        icon: <FolderOpen className="w-4 h-4 text-amber-400" />,
        shortcut: "Ctrl+O",
        perform: () => {
          onClose();
          selectDirectoryAndOpen();
        },
      },
      {
        id: "toggle-term",
        title: "Toggle Integrated Terminal",
        category: "Action",
        icon: <Terminal className="w-4 h-4 text-cyan-400" />,
        shortcut: "Ctrl+`",
        perform: () => {
          onClose();
          toggleDrawer();
        },
      },
      {
        id: "spawn-ps",
        title: "Spawn Fresh PowerShell Session",
        category: "Action",
        icon: <Play className="w-4 h-4 text-blue-400" />,
        perform: () => {
          onClose();
          spawnSession(currentProject?.id);
        },
      },
      {
        id: "refresh-project",
        title: "Rescan Project Context & Dependencies",
        category: "Action",
        icon: <RefreshCw className="w-4 h-4 text-purple-400" />,
        shortcut: "Ctrl+R",
        perform: () => {
          onClose();
          if (currentProject) analyzeProject(currentProject.id);
        },
      },
      {
        id: "detect-agents",
        title: "Detect Installed AI Coding CLIs",
        category: "Action",
        icon: <Bot className="w-4 h-4 text-indigo-400" />,
        perform: () => {
          onClose();
          detectAll();
        },
      },
      // Navigation
      {
        id: "nav-dashboard",
        title: "Go to Dashboard",
        category: "Navigation",
        icon: <FolderOpen className="w-4 h-4 text-slate-400" />,
        perform: () => {
          onClose();
          onNavigate("dashboard");
        },
      },
      {
        id: "nav-projects",
        title: "Go to Projects",
        category: "Navigation",
        icon: <FolderOpen className="w-4 h-4 text-slate-400" />,
        perform: () => {
          onClose();
          onNavigate("projects");
        },
      },
      {
        id: "nav-tasks",
        title: "Go to Tasks",
        category: "Navigation",
        icon: <PlusCircle className="w-4 h-4 text-slate-400" />,
        perform: () => {
          onClose();
          onNavigate("tasks");
        },
      },
      {
        id: "nav-agents",
        title: "Go to Agents",
        category: "Navigation",
        icon: <Bot className="w-4 h-4 text-slate-400" />,
        perform: () => {
          onClose();
          onNavigate("agents");
        },
      },
      {
        id: "nav-changes",
        title: "Go to Git Changes & Diff",
        category: "Navigation",
        icon: <GitBranch className="w-4 h-4 text-slate-400" />,
        perform: () => {
          onClose();
          onNavigate("changes");
        },
      },
      {
        id: "nav-settings",
        title: "Go to Settings",
        category: "Navigation",
        icon: <Settings className="w-4 h-4 text-slate-400" />,
        perform: () => {
          onClose();
          onNavigate("settings");
        },
      },
    ];

    // Add recent projects
    projects.forEach((proj) => {
      list.push({
        id: `project-${proj.id}`,
        title: `Switch to: ${proj.name} (${proj.path})`,
        category: "Projects",
        icon: <FolderOpen className="w-4 h-4 text-blue-400" />,
        perform: () => {
          onClose();
          openProject(proj.path);
        },
      });
    });

    return list;
  }, [
    currentProject,
    projects,
    onClose,
    onNavigate,
    onOpenNewTask,
    selectDirectoryAndOpen,
    openProject,
    toggleDrawer,
    spawnSession,
    analyzeProject,
    detectAll,
  ]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredCommands[selectedIndex];
      if (current) current.perform();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950/50">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            placeholder="Type a command or search actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No matching commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => cmd.perform()}
                className={`flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg cursor-pointer text-sm transition ${
                  idx === selectedIndex
                    ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30"
                    : "text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="p-1.5 rounded-md bg-slate-800 border border-slate-700">
                    {cmd.icon}
                  </span>
                  <div>
                    <div className="font-medium">{cmd.title}</div>
                    <div className="text-xs text-slate-500">{cmd.category}</div>
                  </div>
                </div>
                {cmd.shortcut && (
                  <kbd className="px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded">
                    {cmd.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate with ↑ ↓ · Press Enter to execute</span>
          <span>Esc to exit</span>
        </div>
      </div>
    </div>
  );
}
