use std::path::PathBuf;
use std::process::{Command, Stdio};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvCheck {
    pub name: String,
    pub ok: bool,
    pub detail: String,
}

/// True when a program is on the PATH (`where` on Windows, `which` elsewhere).
fn on_path(program: &str) -> bool {
    let finder = if cfg!(windows) { "where" } else { "which" };
    Command::new(finder)
        .arg(program)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Installs a known tool with winget. Only tools on this list can be installed from the app.
#[tauri::command]
pub async fn environment_install(tool: String) -> Result<String, String> {
    let args: Vec<&str> = match tool.as_str() {
        "ripgrep" => vec![
            "install",
            "--id",
            "BurntSushi.ripgrep.MSVC",
            "-e",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ],
        other => return Err(format!("'{}' cannot be installed from the app", other)),
    };
    if !cfg!(windows) {
        return Err("Automatic install is only available on Windows (winget)".into());
    }

    let output = tokio::task::spawn_blocking(move || Command::new("winget").args(args).output())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("could not run winget: {}", e))?;

    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let tail: Vec<&str> = text.lines().rev().take(6).collect();
    let tail = tail.into_iter().rev().collect::<Vec<_>>().join("\n");

    if output.status.success() {
        Ok(tail)
    } else {
        Err(tail)
    }
}

/// Playwright keeps its browsers in a per-user cache folder.
fn playwright_browsers_installed() -> bool {
    let base: Option<PathBuf> = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join("ms-playwright"))
    } else {
        std::env::var_os("HOME").map(|p| PathBuf::from(p).join(".cache").join("ms-playwright"))
    };
    base.map(|p| p.is_dir()).unwrap_or(false)
}

/// Checks the tools the agents and QA depend on. Warnings only: a missing tool never blocks a run by itself.
/// No GitHub token check: the repos are already initialized, and git uses its own saved credentials.
#[tauri::command]
pub async fn environment_check() -> Result<Vec<EnvCheck>, String> {
    let rg = on_path("rg");
    Ok(vec![
        EnvCheck {
            name: "ripgrep (rg)".into(),
            ok: rg,
            detail: if rg {
                "found".into()
            } else {
                "missing: agents must search with Select-String or findstr".into()
            },
        },
        EnvCheck {
            name: "git".into(),
            ok: on_path("git"),
            detail: if on_path("git") { "found".into() } else { "missing: nothing can be committed".into() },
        },
        EnvCheck {
            name: "node".into(),
            ok: on_path("node"),
            detail: if on_path("node") { "found".into() } else { "missing: Node projects cannot build or test".into() },
        },
        EnvCheck {
            name: "playwright browsers".into(),
            ok: playwright_browsers_installed(),
            detail: if playwright_browsers_installed() {
                "installed".into()
            } else {
                "missing: browser tests (test:e2e) will fail; run npx playwright install".into()
            },
        },
    ])
}
