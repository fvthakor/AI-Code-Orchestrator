use std::env;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct WindowsExecutableResolver;

impl WindowsExecutableResolver {
    pub fn resolve_binary(name: &str) -> Option<PathBuf> {
        let path_obj = Path::new(name);
        if path_obj.is_absolute() && path_obj.exists() {
            return Some(path_obj.to_path_buf());
        }

        let extensions = ["", ".cmd", ".exe", ".bat"];

        // 1. Check with which crate across PATH
        for ext in &extensions {
            let candidate_name = if name.to_lowercase().ends_with(ext) || ext.is_empty() {
                name.to_string()
            } else {
                format!("{}{}", name, ext)
            };

            if let Ok(path) = which::which(&candidate_name) {
                if path.exists() {
                    return Some(path);
                }
            }
        }

        // 2. Check well-known Windows tool directories
        let mut search_dirs = Vec::new();

        // Node / NVM
        search_dirs.push(PathBuf::from(r"C:\nvm4w\nodejs"));
        search_dirs.push(PathBuf::from(r"C:\Program Files\nodejs"));

        if let Ok(appdata) = env::var("APPDATA") {
            search_dirs.push(PathBuf::from(appdata).join("npm"));
        }

        if let Ok(userprofile) = env::var("USERPROFILE") {
            let user_dir = PathBuf::from(&userprofile);
            search_dirs.push(user_dir.join(".cargo").join("bin"));
            search_dirs.push(user_dir.join("scoop").join("shims"));
            search_dirs.push(user_dir.join("AppData").join("Local").join("Programs"));
        }

        for dir in search_dirs {
            if dir.exists() {
                for ext in &extensions {
                    let file_name = if name.to_lowercase().ends_with(ext) || ext.is_empty() {
                        name.to_string()
                    } else {
                        format!("{}{}", name, ext)
                    };
                    let candidate = dir.join(file_name);
                    if candidate.exists() {
                        return Some(candidate);
                    }
                }
            }
        }

        None
    }

    pub fn get_version(executable: &Path, flag: &str) -> Option<String> {
        // Run safely without opening a window
        let mut cmd = Command::new("powershell.exe");
        cmd.args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &format!("& \"{}\" {}", executable.display(), flag),
        ]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
            // Some tools output version to stderr
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if !err.is_empty() && output.status.success() {
                return Some(err);
            }
        }
        None
    }
}
