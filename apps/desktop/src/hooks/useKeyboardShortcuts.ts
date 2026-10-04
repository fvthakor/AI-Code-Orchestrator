import { useEffect } from "react";
import { useProjectStore } from "../stores/useProjectStore";
import { useTerminalStore } from "../stores/useTerminalStore";

interface ShortcutHandlers {
  onOpenCommandPalette?: () => void;
  onOpenNewTaskModal?: () => void;
  onRunActiveTask?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const selectDirectoryAndOpen = useProjectStore((s) => s.selectDirectoryAndOpen);
  const currentProject = useProjectStore((s) => s.currentProject);
  const analyzeProject = useProjectStore((s) => s.analyzeProject);
  const toggleDrawer = useTerminalStore((s) => s.toggleDrawer);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is actively typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.classList.contains("xterm-helper-textarea"));

      // Ctrl + ` -> Toggle Terminal
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        toggleDrawer();
        return;
      }

      // Ctrl + Shift + P -> Command Palette
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        handlers.onOpenCommandPalette?.();
        return;
      }

      // Ctrl + Shift + T -> New Task Modal
      if (e.ctrlKey && e.shiftKey && (e.key === "T" || e.key === "t")) {
        e.preventDefault();
        handlers.onOpenNewTaskModal?.();
        return;
      }

      // Ctrl + O -> Open Project
      if (e.ctrlKey && (e.key === "O" || e.key === "o") && !e.shiftKey) {
        e.preventDefault();
        selectDirectoryAndOpen();
        return;
      }

      // Ctrl + R -> Refresh Project
      if (e.ctrlKey && (e.key === "R" || e.key === "r") && !e.shiftKey) {
        if (currentProject) {
          e.preventDefault();
          analyzeProject(currentProject.id);
        }
        return;
      }

      // Ctrl + Enter -> Run Task (if not inside textarea)
      if (e.ctrlKey && e.key === "Enter" && !isInput) {
        e.preventDefault();
        handlers.onRunActiveTask?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectDirectoryAndOpen, currentProject, analyzeProject, toggleDrawer, handlers]);
}
