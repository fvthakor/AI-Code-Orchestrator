use crate::filesystem::path_guard::PathGuard;

pub struct CommandSanitizer;

impl CommandSanitizer {
    pub fn contains_sensitive_target(command: &str) -> bool {
        let tokens: Vec<&str> = command.split_whitespace().collect();
        for token in tokens {
            let clean = token.trim_matches(|c| c == '"' || c == '\'' || c == '`');
            if clean.starts_with(".env")
                || clean.ends_with(".env")
                || clean.contains(".env.")
                || clean.contains(".ssh")
                || clean.contains("id_rsa")
                || clean.contains("id_ed25519")
                || PathGuard::is_sensitive_path(clean)
            {
                return true;
            }
        }
        false
    }
}
