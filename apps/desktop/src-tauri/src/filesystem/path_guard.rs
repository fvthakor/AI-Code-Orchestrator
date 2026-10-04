use std::path::{Path, PathBuf};

pub struct PathGuard;

impl PathGuard {
    pub fn validate_project_path(raw_path: &str) -> Result<PathBuf, String> {
        let trimmed = raw_path.trim();
        if trimmed.is_empty() {
            return Err("Project path cannot be empty".to_string());
        }

        let path = PathBuf::from(trimmed);
        if !path.exists() {
            return Err(format!("Directory does not exist: {}", trimmed));
        }

        if !path.is_dir() {
            return Err(format!("Specified path is not a directory: {}", trimmed));
        }

        if Self::is_sensitive_path(trimmed) {
            return Err(format!("Access to sensitive system or profile path is blocked: {}", trimmed));
        }

        match path.canonicalize() {
            Ok(canonical) => {
                let s = canonical.to_string_lossy();
                let clean = if let Some(stripped) = s.strip_prefix(r"\\?\") {
                    PathBuf::from(stripped)
                } else {
                    canonical
                };
                Ok(clean)
            }
            Err(e) => Err(format!("Failed to resolve path: {}", e)),
        }
    }

    pub fn is_sensitive_path(path_str: &str) -> bool {
        let lower = path_str.to_lowercase().replace('/', "\\");

        // Windows system directories
        if lower.contains("c:\\windows") || lower.contains("c:\\program files") || lower.contains("c:\\programdata") {
            return true;
        }

        // SSH and credential locations
        if lower.contains("\\.ssh") || lower.contains("\\.gnupg") || lower.contains("id_rsa") || lower.contains("id_ed25519") {
            return true;
        }

        // Environment and secret files
        if lower.ends_with("\\.env") || lower.contains("\\.env.") || lower.ends_with("/.env") {
            return true;
        }

        // Browser user data
        if lower.contains("\\appdata\\local\\google\\chrome") || lower.contains("\\appdata\\roaming\\mozilla") {
            return true;
        }

        false
    }

    pub fn ensure_inside_project(project_root: &Path, target_path: impl AsRef<Path>) -> Result<PathBuf, String> {
        let root_canon = project_root
            .canonicalize()
            .unwrap_or_else(|_| project_root.to_path_buf());

        let target = if target_path.as_ref().is_absolute() {
            target_path.as_ref().to_path_buf()
        } else {
            root_canon.join(target_path.as_ref())
        };

        // Normalize target path without requiring it to exist yet
        let mut normalized = Vec::new();
        for component in target.components() {
            match component {
                std::path::Component::Prefix(p) => normalized.push(p.as_os_str().to_os_string()),
                std::path::Component::RootDir => normalized.push(std::ffi::OsString::from("\\")),
                std::path::Component::CurDir => {}
                std::path::Component::ParentDir => {
                    if !normalized.is_empty() {
                        normalized.pop();
                    }
                }
                std::path::Component::Normal(c) => normalized.push(c.to_os_string()),
            }
        }

        let mut reconstructed = PathBuf::new();
        for comp in normalized {
            reconstructed.push(comp);
        }

        let root_clean = clean_path_str(&root_canon.to_string_lossy());
        let target_clean = clean_path_str(&reconstructed.to_string_lossy());

        if !target_clean.starts_with(&root_clean) {
            return Err(format!(
                "Security violation: path '{}' escapes project root '{}'",
                target_clean, root_clean
            ));
        }

        Ok(reconstructed)
    }
}

fn clean_path_str(s: &str) -> String {
    let lower = s.to_lowercase().replace('/', "\\");
    if let Some(stripped) = lower.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        lower
    }
}
