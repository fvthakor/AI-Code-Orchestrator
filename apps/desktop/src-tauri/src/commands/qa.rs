use std::collections::BTreeSet;
use std::fs;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use regex::Regex;
use serde::Serialize;
use tauri::State;

use crate::database::DbManager;

#[derive(Serialize)]
pub struct QaCheck {
    pub name: String,
    pub passed: bool,
    pub detail: String,
}

#[derive(Serialize)]
pub struct QaReport {
    pub passed: bool,
    pub checks: Vec<QaCheck>,
}

/// What the gap detector found in a project. Planner uses it to build the Gap Fill task.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GapReport {
    pub gaps: Vec<String>,
    pub env_vars: Vec<String>,
    pub ports: Vec<String>,
    pub has_package_json: bool,
    pub has_start_script: bool,
    pub has_e2e_script: bool,
    pub has_run_section: bool,
}

const INSTALL_TIMEOUT: Duration = Duration::from_secs(300);
const SCRIPT_TIMEOUT: Duration = Duration::from_secs(300);
const BOOT_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_SOURCE_BYTES: u64 = 1_000_000;
const SOURCE_EXTS: &[&str] = &["js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "go"];
const SKIP_DIRS: &[&str] = &[
    "node_modules", "dist", "build", "coverage", ".git", ".tmp-tests", "target", "venv", ".venv", "__pycache__",
];

fn temp_log_path() -> PathBuf {
    std::env::temp_dir().join(format!("qa-{}.log", uuid::Uuid::new_v4()))
}

/// Builds an `npm <args>` command in `dir`.
fn npm_command(dir: &Path, args: &[&str]) -> Command {
    // npm is a .cmd shim on Windows, so it has to be launched through cmd
    let mut cmd = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.arg("/C").arg("npm").args(args);
        c
    } else {
        let mut c = Command::new("npm");
        c.args(args);
        c
    };
    // CI=true stops watch-mode test runners from hanging
    cmd.current_dir(dir).env("CI", "true").stdin(Stdio::null());
    cmd
}

/// Last 40 lines of a log file.
fn read_tail(path: &Path) -> String {
    let output = fs::read_to_string(path).unwrap_or_default();
    let mut tail: Vec<&str> = output.lines().rev().take(40).collect();
    tail.reverse();
    tail.join("\n")
}

/// Stops a child and, on Windows, its whole tree (npm -> node server).
fn kill_tree(child: &mut Child) {
    if cfg!(windows) {
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// Runs `npm <args>` in `dir` with a hard timeout. Returns (success, output tail).
fn run_npm(dir: &Path, args: &[&str], timeout: Duration) -> Result<(bool, String), String> {
    let log_path = temp_log_path();
    let log = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let log_err = log.try_clone().map_err(|e| e.to_string())?;

    let mut child = npm_command(dir, args)
        .stdout(log)
        .stderr(log_err)
        .spawn()
        .map_err(|e| format!("failed to start npm {}: {}", args.join(" "), e))?;

    let start = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break Some(status);
        }
        if start.elapsed() > timeout {
            kill_tree(&mut child);
            break None;
        }
        std::thread::sleep(Duration::from_millis(500));
    };

    let tail = read_tail(&log_path);
    let _ = fs::remove_file(&log_path);

    match status {
        Some(s) if s.success() => Ok((true, tail)),
        Some(s) => Ok((false, format!("exit code {:?}\n{}", s.code(), tail))),
        None => Ok((false, format!("timed out after {}s\n{}", timeout.as_secs(), tail))),
    }
}

/// Reads `package.json` scripts from a directory, if present.
fn package_scripts(dir: &Path) -> Option<serde_json::Map<String, serde_json::Value>> {
    let raw = fs::read_to_string(dir.join("package.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("scripts")?.as_object().cloned()
}

/// Every active `KEY=value` line in a `.env.example` file. Commented-out keys do not count.
fn env_example_entries(path: &Path) -> Vec<(String, String)> {
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    raw.lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let (key, value) = line.split_once('=')?;
            let value = value.trim().trim_matches('"').trim_matches('\'');
            Some((key.trim().to_string(), value.to_string()))
        })
        .collect()
}

/// `*_PORT` entries from parsed `.env.example` entries, with numeric values only.
fn port_entries(entries: &[(String, String)]) -> Vec<(String, u16)> {
    entries
        .iter()
        .filter(|(key, _)| key.ends_with("PORT"))
        .filter_map(|(key, value)| value.parse::<u16>().ok().map(|port| (key.clone(), port)))
        .collect()
}

/// `.env.example` files at the project root and in frontend/, if present.
fn example_files(root: &Path) -> Vec<PathBuf> {
    [root.join(".env.example"), root.join("frontend").join(".env.example")]
        .into_iter()
        .filter(|f| f.exists())
        .collect()
}

/// Regexes for environment reads in the common stacks.
fn env_patterns() -> Vec<Regex> {
    [
        r"process\.env\.([A-Z][A-Z0-9_]*)",
        r#"process\.env\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]"#,
        r"import\.meta\.env\.([A-Z][A-Z0-9_]*)",
        r#"os\.(?:environ|getenv)(?:\.get)?\s*[\[(]\s*["']([A-Z][A-Z0-9_]*)["']"#,
        r#"os\.Getenv\(\s*"([A-Z][A-Z0-9_]*)""#,
    ]
    .iter()
    .map(|p| Regex::new(p).expect("env pattern is a valid regex"))
    .collect()
}

fn collect_source_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) {
                collect_source_files(&path, out);
            }
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if SOURCE_EXTS.contains(&ext) {
                out.push(path);
            }
        }
    }
}

/// Every environment variable the source reads, with the file it was first seen in. Sorted by name.
fn discover_env_vars(root: &Path) -> Vec<(String, String)> {
    let patterns = env_patterns();
    let mut files = Vec::new();
    collect_source_files(root, &mut files);

    let mut seen = BTreeSet::new();
    let mut found = Vec::new();
    for file in files {
        let too_big = fs::metadata(&file).map(|m| m.len() > MAX_SOURCE_BYTES).unwrap_or(true);
        if too_big {
            continue;
        }
        let Ok(text) = fs::read_to_string(&file) else {
            continue;
        };
        let rel = file.strip_prefix(root).unwrap_or(&file).display().to_string();
        for re in &patterns {
            for cap in re.captures_iter(&text) {
                let name = cap[1].to_string();
                if seen.insert(name.clone()) {
                    found.push((name, rel.clone()));
                }
            }
        }
    }
    found.sort();
    found
}

/// Variables the code reads that no `.env.example` documents.
fn missing_env_keys(used: &[(String, String)], documented: &[String]) -> Vec<(String, String)> {
    used.iter()
        .filter(|(name, _)| !documented.contains(name))
        .cloned()
        .collect()
}

/// First pair of ports that are equal, if any.
fn duplicate_port(ports: &[(String, u16)]) -> Option<String> {
    for (i, (key_a, port_a)) in ports.iter().enumerate() {
        for (key_b, port_b) in ports.iter().skip(i + 1) {
            if port_a == port_b {
                return Some(format!("{} and {} both use port {}", key_a, key_b, port_a));
            }
        }
    }
    None
}

/// True when the README has a heading about running, starting, or using the app.
fn has_run_heading(readme: &str) -> bool {
    readme.lines().map(|l| l.trim().to_lowercase()).any(|l| {
        l.starts_with('#') && (l.contains("run") || l.contains("start") || l.contains("usage"))
    })
}

/// Starts the app from its own start script and waits until every port answers. Then stops it.
fn boot_and_probe(root: &Path, script: &str, ports: &[u16]) -> Result<String, String> {
    let log_path = temp_log_path();
    let log = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let log_err = log.try_clone().map_err(|e| e.to_string())?;

    let mut child = npm_command(root, &["run", script])
        .stdout(log)
        .stderr(log_err)
        .spawn()
        .map_err(|e| format!("failed to start npm run {}: {}", script, e))?;

    let start = Instant::now();
    let result = loop {
        let all_up = ports.iter().all(|p| {
            TcpStream::connect_timeout(
                &SocketAddr::from(([127, 0, 0, 1], *p)),
                Duration::from_millis(300),
            )
            .is_ok()
        });
        if all_up {
            break Ok(format!("'npm run {}' started and ports {:?} answered", script, ports));
        }
        if let Ok(Some(status)) = child.try_wait() {
            break Err(format!(
                "'npm run {}' exited ({:?}) before the ports answered\n{}",
                script,
                status.code(),
                read_tail(&log_path)
            ));
        }
        if start.elapsed() > BOOT_TIMEOUT {
            break Err(format!(
                "ports {:?} did not answer within {}s\n{}",
                ports,
                BOOT_TIMEOUT.as_secs(),
                read_tail(&log_path)
            ));
        }
        std::thread::sleep(Duration::from_millis(500));
    };

    kill_tree(&mut child);
    let _ = fs::remove_file(&log_path);
    result
}

/// Boots the app from `.env.example` alone. A temporary `.env` is created for the check and removed after.
fn boot_check(root: &Path, ports: &[u16]) -> QaCheck {
    let scripts = package_scripts(root).unwrap_or_default();
    let script = if scripts.contains_key("start") { "start" } else { "dev" };

    let example = root.join(".env.example");
    let env_file = root.join(".env");
    let created_env = !env_file.exists() && example.exists();
    if created_env {
        if let Err(e) = fs::copy(&example, &env_file) {
            return QaCheck {
                name: "boot".into(),
                passed: false,
                detail: format!("could not copy .env.example to .env: {}", e),
            };
        }
    }

    let result = boot_and_probe(root, script, ports);
    if created_env {
        let _ = fs::remove_file(&env_file);
    }

    match result {
        Ok(detail) => QaCheck { name: "boot".into(), passed: true, detail },
        Err(detail) => QaCheck { name: "boot".into(), passed: false, detail },
    }
}

/// Fast, script-free scan of what a project is missing. Used to plan the Gap Fill task.
fn gap_report(root: &Path) -> GapReport {
    let has_package_json = root.join("package.json").exists();
    let scripts = package_scripts(root).unwrap_or_default();
    let has_start_script = scripts.contains_key("start") || scripts.contains_key("dev");
    let has_e2e_script = scripts.contains_key("test:e2e");
    let has_run_section = fs::read_to_string(root.join("README.md"))
        .map(|t| has_run_heading(&t))
        .unwrap_or(false);

    let files = example_files(root);
    let entries: Vec<(String, String)> = files.iter().flat_map(|f| env_example_entries(f)).collect();
    let documented: Vec<String> = entries.iter().map(|(k, _)| k.clone()).collect();
    let ports = port_entries(&entries);
    let used = discover_env_vars(root);
    let missing = missing_env_keys(&used, &documented);

    let mut gaps = Vec::new();
    if has_package_json {
        if files.is_empty() {
            gaps.push("no .env.example at project root or frontend/".to_string());
        }
        for (name, file) in &missing {
            gaps.push(format!("{} is read in {} but not listed in .env.example", name, file));
        }
        if has_start_script && ports.is_empty() {
            gaps.push("app has a start/dev script but .env.example declares no *_PORT".to_string());
        }
        if !has_run_section {
            gaps.push("README.md has no Run section".to_string());
        }
        if !has_e2e_script {
            gaps.push("no test:e2e script (Playwright browser tests)".to_string());
        }
    }

    GapReport {
        gaps,
        env_vars: used.into_iter().map(|(name, _)| name).collect(),
        ports: ports.iter().map(|(k, p)| format!("{}={}", k, p)).collect(),
        has_package_json,
        has_start_script,
        has_e2e_script,
        has_run_section,
    }
}

fn run_checks(root: &Path) -> QaReport {
    let mut checks: Vec<QaCheck> = Vec::new();
    let project_dirs: Vec<PathBuf> = [root.to_path_buf(), root.join("frontend")]
        .into_iter()
        .filter(|d| d.join("package.json").exists())
        .collect();

    let runnable = project_dirs.iter().any(|d| {
        package_scripts(d).map_or(false, |s| s.contains_key("start") || s.contains_key("dev"))
    });

    // 1. Environment template must exist, so the app can be run by anyone
    let files = example_files(root);
    checks.push(QaCheck {
        name: "env-example".into(),
        passed: !files.is_empty(),
        detail: if files.is_empty() {
            "no .env.example found at project root or frontend/".into()
        } else {
            format!("found {} .env.example file(s)", files.len())
        },
    });

    // 2. Every environment variable the code reads must be documented in .env.example
    let entries: Vec<(String, String)> = files.iter().flat_map(|f| env_example_entries(f)).collect();
    let documented: Vec<String> = entries.iter().map(|(k, _)| k.clone()).collect();
    let used = discover_env_vars(root);
    let missing = missing_env_keys(&used, &documented);
    checks.push(QaCheck {
        name: "env-coverage".into(),
        passed: missing.is_empty(),
        detail: if missing.is_empty() {
            format!("all {} environment variable(s) the code reads are documented", used.len())
        } else {
            missing
                .iter()
                .map(|(name, file)| format!("{} (read in {})", name, file))
                .collect::<Vec<_>>()
                .join("; ")
        },
    });

    // 3. A runnable app must declare its ports, and they must be distinct
    let ports = port_entries(&entries);
    checks.push(QaCheck {
        name: "ports-declared".into(),
        passed: !runnable || !ports.is_empty(),
        detail: if !runnable {
            "no start/dev script; ports not required".into()
        } else if ports.is_empty() {
            "app has a start/dev script but .env.example declares no *_PORT".into()
        } else {
            format!("{} port setting(s) declared", ports.len())
        },
    });
    let duplicate = duplicate_port(&ports);
    checks.push(QaCheck {
        name: "ports-distinct".into(),
        passed: duplicate.is_none(),
        detail: duplicate.unwrap_or_else(|| format!("{} port setting(s) are distinct", ports.len())),
    });

    // 4. Declared ports must be free before anything is started
    let mut all_free = true;
    for (key, port) in &ports {
        let free = TcpListener::bind(("127.0.0.1", *port)).is_ok();
        all_free &= free;
        checks.push(QaCheck {
            name: format!("port-free-{}", key),
            passed: free,
            detail: if free {
                format!("port {} is free", port)
            } else {
                format!("port {} is already in use", port)
            },
        });
    }

    // 5. Install, then build / lint / test / test:e2e in every project directory that has scripts
    for dir in &project_dirs {
        let label = dir
            .strip_prefix(root)
            .ok()
            .map(|p| p.display().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| ".".into());

        if !dir.join("node_modules").exists() {
            let result = run_npm(dir, &["install"], INSTALL_TIMEOUT)
                .unwrap_or_else(|e| (false, e));
            checks.push(QaCheck {
                name: format!("install ({})", label),
                passed: result.0,
                detail: result.1,
            });
        }

        let scripts = package_scripts(dir).unwrap_or_default();
        for script in ["build", "lint", "test", "test:e2e"] {
            let Some(body) = scripts.get(script).and_then(|v| v.as_str()) else {
                continue;
            };
            // npm's default placeholder test script is not a real test suite
            if script == "test" && body.contains("no test specified") {
                continue;
            }
            let result = run_npm(dir, &["run", script], SCRIPT_TIMEOUT).unwrap_or_else(|e| (false, e));
            checks.push(QaCheck {
                name: format!("{} ({})", script, label),
                passed: result.0,
                detail: result.1,
            });
        }
    }

    // 6. Boot the root app from .env.example alone and confirm its ports answer
    let root_scripts = package_scripts(root).unwrap_or_default();
    let root_runnable = root_scripts.contains_key("start") || root_scripts.contains_key("dev");
    if root_runnable && !ports.is_empty() {
        if all_free {
            let port_numbers: Vec<u16> = ports.iter().map(|(_, p)| *p).collect();
            checks.push(boot_check(root, &port_numbers));
        } else {
            checks.push(QaCheck {
                name: "boot".into(),
                passed: false,
                detail: "skipped: a declared port is already in use".into(),
            });
        }
    }

    QaReport {
        passed: checks.iter().all(|c| c.passed),
        checks,
    }
}

/// Automatic, script-based QA gate: env template, env coverage, ports, install, build, lint, test, e2e, boot.
#[tauri::command]
pub async fn qa_static_checks(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<QaReport, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let root = PathBuf::from(&p.path);
    tokio::task::spawn_blocking(move || run_checks(&root))
        .await
        .map_err(|e| e.to_string())
}

/// Gap detector for existing projects: what the planner must fix before feature work.
#[tauri::command]
pub async fn qa_gap_report(
    project_id: String,
    db: State<'_, DbManager>,
) -> Result<GapReport, String> {
    let p = db
        .get_project_by_id(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let root = PathBuf::from(&p.path);
    tokio::task::spawn_blocking(move || gap_report(&root))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_entries_skip_comments_and_strip_quotes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(".env.example");
        fs::write(&path, "# OLD_KEY=1\nBACKEND_PORT=\"3001\"\nAPI_URL='http://x'\n").unwrap();
        let entries = env_example_entries(&path);
        assert_eq!(
            entries,
            vec![
                ("BACKEND_PORT".to_string(), "3001".to_string()),
                ("API_URL".to_string(), "http://x".to_string()),
            ]
        );
    }

    #[test]
    fn discovers_env_reads_across_languages_and_skips_node_modules() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("src")).unwrap();
        fs::write(
            dir.path().join("src/server.js"),
            "const p = process.env.BACKEND_PORT; const k = process.env['DB_URL'];",
        )
        .unwrap();
        fs::write(dir.path().join("src/app.ts"), "const u = import.meta.env.VITE_API_URL;").unwrap();
        fs::write(
            dir.path().join("svc.py"),
            "import os\nx = os.environ['REDIS_HOST']\ny = os.getenv(\"QUEUE_NAME\")",
        )
        .unwrap();
        fs::create_dir_all(dir.path().join("node_modules/pkg")).unwrap();
        fs::write(dir.path().join("node_modules/pkg/index.js"), "process.env.SHOULD_SKIP").unwrap();

        let names: Vec<String> = discover_env_vars(dir.path()).into_iter().map(|(n, _)| n).collect();
        for expected in ["BACKEND_PORT", "DB_URL", "VITE_API_URL", "REDIS_HOST", "QUEUE_NAME"] {
            assert!(names.contains(&expected.to_string()), "missing {}", expected);
        }
        assert!(!names.contains(&"SHOULD_SKIP".to_string()));
    }

    #[test]
    fn reports_undocumented_env_vars() {
        let used: Vec<(String, String)> = vec![
            ("BACKEND_PORT".into(), "a.js".into()),
            ("DB_URL".into(), "b.js".into()),
        ];
        let documented = vec!["BACKEND_PORT".to_string()];
        assert_eq!(
            missing_env_keys(&used, &documented),
            vec![("DB_URL".to_string(), "b.js".to_string())]
        );
    }

    #[test]
    fn detects_duplicate_ports() {
        let clash: Vec<(String, u16)> = vec![("BACKEND_PORT".into(), 3000), ("FRONTEND_PORT".into(), 3000)];
        assert!(duplicate_port(&clash).is_some());
        let distinct: Vec<(String, u16)> = vec![("A".into(), 1), ("B".into(), 2)];
        assert!(duplicate_port(&distinct).is_none());
    }

    #[test]
    fn detects_run_section_in_readme() {
        assert!(has_run_heading("# App\n\n## Running locally\n"));
        assert!(has_run_heading("# App\n\n## Getting started\n"));
        assert!(!has_run_heading("# App\n\n## Features\n"));
    }
}
