import { useState } from "react";
import {
  FolderOpen,
  Trash2,
  RefreshCw,
  FolderGit2,
  ArrowRight,
  Search,
} from "lucide-react";
import { useProjectStore } from "../stores/useProjectStore";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import type { NavPage } from "../layouts/AppLayout";

interface ProjectsPageProps {
  onNavigate: (page: NavPage) => void;
}

export function ProjectsPage({ onNavigate }: ProjectsPageProps) {
  const {
    projects,
    currentProject,
    openProject,
    selectDirectoryAndOpen,
    deleteProject,
    analyzeProject,
  } = useProjectStore();

  const [manualPath, setManualPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleManualOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPath.trim()) return;
    const res = await openProject(manualPath.trim());
    if (res) {
      setManualPath("");
      onNavigate("dashboard");
    }
  };

  const handleSelectFolder = async () => {
    const res = await selectDirectoryAndOpen();
    if (res) {
      onNavigate("dashboard");
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Project Manager</h2>
          <p className="text-xs text-slate-400 mt-1">
            Open and switch local software repositories guarded by path validation.
          </p>
        </div>

        <Button onClick={handleSelectFolder} className="flex items-center space-x-2 shrink-0">
          <FolderOpen className="w-4 h-4" />
          <span>Browse Folder</span>
        </Button>
      </div>

      {/* Manual Path Input Card */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-4">
          <form onSubmit={handleManualOpen} className="flex items-center space-x-3">
            <div className="relative flex-1">
              <FolderOpen className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <Input
                type="text"
                placeholder="Paste absolute path, e.g. E:\window-software\MyProject"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                className="pl-9 text-xs font-mono"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={!manualPath.trim()}>
              Open Path
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Search projects by name or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono">
          {projects.length} {projects.length === 1 ? "project" : "projects"} tracked
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            No projects found. Click "Browse Folder" to add a project.
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isActive = currentProject?.id === project.id;

            return (
              <div
                key={project.id}
                className={`p-5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isActive
                    ? "bg-indigo-600/10 border-indigo-500/40 shadow-sm"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-semibold text-sm text-slate-200 truncate">
                      {project.name}
                    </span>
                    {isActive && (
                      <Badge variant="default" className="text-[10px] bg-indigo-600 text-white">
                        Active
                      </Badge>
                    )}
                    {project.git?.branch && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        <FolderGit2 className="w-3 h-3 text-indigo-400" />
                        <span>{project.git.branch}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-mono text-slate-400 truncate max-w-2xl">
                    {project.path}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {project.stack?.languages.map((l: string) => (
                      <span
                        key={l}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        {l}
                      </span>
                    ))}
                    {project.stack?.frameworks.map((f: string) => (
                      <span
                        key={f}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/40"
                      >
                        {f}
                      </span>
                    ))}
                    {project.stack?.packageManagers.map((pm: string) => (
                      <span
                        key={pm}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800"
                      >
                        {pm}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => analyzeProject(project.id)}
                    title="Rescan metadata"
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteProject(project.id)}
                    title="Remove from history"
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>

                  {isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate("dashboard")}
                      className="text-xs flex items-center space-x-1.5"
                    >
                      <span>Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await openProject(project.path);
                        onNavigate("dashboard");
                      }}
                      className="text-xs"
                    >
                      Switch Project
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
