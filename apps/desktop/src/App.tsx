import { useState, useEffect } from "react";
import { AppLayout, type NavPage } from "./layouts/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { TasksPage } from "./pages/TasksPage";
import { AgentsPage } from "./pages/AgentsPage";
import { ChangesPage } from "./pages/ChangesPage";
import { ExecutionsPage } from "./pages/ExecutionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TeamPage } from "./pages/TeamPage";
import { NewTaskModal } from "./components/NewTaskModal";
import { useProjectStore } from "./stores/useProjectStore";
import { useAgentStore } from "./stores/useAgentStore";
import { useTerminalStore } from "./stores/useTerminalStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>("dashboard");
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  const { projects, currentProject, loadProjects, setCurrentProject } = useProjectStore();
  const { detectAll } = useAgentStore();
  const { openDrawer } = useTerminalStore();

  // Load projects and detect CLI agents on startup
  useEffect(() => {
    loadProjects();
    detectAll();
  }, [loadProjects, detectAll]);

  // If projects exist but none selected, set the first as default
  useEffect(() => {
    if (!currentProject && projects.length > 0) {
      setCurrentProject(projects[0]);
    }
  }, [projects, currentProject, setCurrentProject]);

  // Hook global keyboard shortcuts
  useKeyboardShortcuts({
    onOpenNewTaskModal: () => setIsNewTaskOpen(true),
  });

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <DashboardPage
            onNavigate={setCurrentPage}
            onOpenNewTask={() => setIsNewTaskOpen(true)}
          />
        );
      case "projects":
        return (
          <ProjectsPage
            onNavigate={setCurrentPage}
            onOpenNewTask={() => setIsNewTaskOpen(true)}
          />
        );
      case "tasks":
        return <TasksPage onOpenNewTask={() => setIsNewTaskOpen(true)} />;
      case "agents":
        return <AgentsPage />;
      case "changes":
        return <ChangesPage />;
      case "executions":
        return <ExecutionsPage />;
      case "team":
        return <TeamPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            onNavigate={setCurrentPage}
            onOpenNewTask={() => setIsNewTaskOpen(true)}
          />
        );
    }
  };

  return (
    <>
      <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderCurrentPage()}
      </AppLayout>

      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onTaskStarted={() => {
          openDrawer();
          setCurrentPage("tasks");
        }}
      />
    </>
  );
}
