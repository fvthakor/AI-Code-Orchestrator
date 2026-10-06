import { useEffect, useState } from "react";
import { IpcService } from "../../services/ipc";

interface EnvCheckItem {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * Shows tools the agents need that are missing, with an install button where the app knows how.
 * Renders nothing when everything is in place.
 */
export function EnvironmentStatus() {
  const [checks, setChecks] = useState<EnvCheckItem[]>([]);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setChecks(await IpcService.environmentCheck());
    } catch {
      // The check is advisory; an error here should not break the dashboard
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const missing = checks.filter((c) => !c.ok);
  if (missing.length === 0) return null;

  const installRipgrep = async () => {
    setInstalling(true);
    setMessage(null);
    try {
      await IpcService.environmentInstall("ripgrep");
      setMessage("Installed. Restart the app so the agents can see ripgrep.");
    } catch (err) {
      setMessage(`Install failed: ${String(err).split("\n").slice(-2).join(" ")}`);
    } finally {
      setInstalling(false);
      await load();
    }
  };

  const canInstallRipgrep = missing.some((c) => c.name === "ripgrep (rg)");

  return (
    <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-700/50 text-xs space-y-2">
      <div className="font-medium text-amber-300">Missing tools</div>
      <ul className="space-y-0.5 text-amber-100/90">
        {missing.map((c) => (
          <li key={c.name}>
            <span className="font-mono">{c.name}</span>: {c.detail}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        {canInstallRipgrep && (
          <button
            type="button"
            disabled={installing}
            onClick={() => void installRipgrep()}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
          >
            {installing ? "Installing ripgrep..." : "Install ripgrep"}
          </button>
        )}
        {message && <span className="text-amber-200">{message}</span>}
      </div>
    </div>
  );
}
