use std::collections::HashSet;
use std::fs;
use std::path::Path;
use serde_json::Value;

use crate::project::context::{DetectedStack, ScannedProjectContext};

pub struct ProjectScanner;

impl ProjectScanner {
    pub fn scan(dir: &Path) -> Result<ScannedProjectContext, String> {
        if !dir.is_dir() {
            return Err(format!("Not a directory: {:?}", dir));
        }

        let dir_name = dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("project")
            .to_string();

        let mut name = dir_name;
        let mut languages = HashSet::new();
        let mut frameworks = HashSet::new();
        let mut package_managers = HashSet::new();
        let mut databases = HashSet::new();
        let mut infrastructure = HashSet::new();

        let has_git = dir.join(".git").exists();

        // 1. Inspect package.json
        let pkg_path = dir.join("package.json");
        if pkg_path.exists() {
            languages.insert("JavaScript".to_string());
            if let Ok(content) = fs::read_to_string(&pkg_path) {
                if let Ok(val) = serde_json::from_str::<Value>(&content) {
                    if let Some(pkg_name) = val.get("name").and_then(|n| n.as_str()) {
                        if !pkg_name.is_empty() {
                            name = pkg_name.to_string();
                        }
                    }

                    let mut all_deps = Vec::new();
                    if let Some(deps) = val.get("dependencies").and_then(|d| d.as_object()) {
                        for (k, _) in deps {
                            all_deps.push(k.to_lowercase());
                        }
                    }
                    if let Some(dev_deps) = val.get("devDependencies").and_then(|d| d.as_object()) {
                        for (k, _) in dev_deps {
                            all_deps.push(k.to_lowercase());
                        }
                    }

                    for dep in &all_deps {
                        if dep == "typescript" {
                            languages.insert("TypeScript".to_string());
                        } else if dep == "react" || dep == "react-dom" {
                            frameworks.insert("React".to_string());
                        } else if dep == "next" {
                            frameworks.insert("Next.js".to_string());
                        } else if dep == "vue" {
                            frameworks.insert("Vue".to_string());
                        } else if dep.starts_with("@angular") {
                            frameworks.insert("Angular".to_string());
                        } else if dep.starts_with("@nestjs") {
                            frameworks.insert("NestJS".to_string());
                        } else if dep == "vite" {
                            frameworks.insert("Vite".to_string());
                        } else if dep == "tailwindcss" {
                            frameworks.insert("Tailwind CSS".to_string());
                        } else if dep == "prisma" || dep == "@prisma/client" {
                            databases.insert("Prisma".to_string());
                        } else if dep == "mongoose" || dep == "mongodb" {
                            databases.insert("MongoDB".to_string());
                        } else if dep == "pg" || dep == "postgres" {
                            databases.insert("PostgreSQL".to_string());
                        } else if dep == "mysql" || dep == "mysql2" {
                            databases.insert("MySQL".to_string());
                        } else if dep == "sqlite3" || dep == "better-sqlite3" {
                            databases.insert("SQLite".to_string());
                        }
                    }
                }
            }
        }

        // Lockfiles
        if dir.join("pnpm-lock.yaml").exists() {
            package_managers.insert("pnpm".to_string());
        }
        if dir.join("package-lock.json").exists() {
            package_managers.insert("npm".to_string());
        }
        if dir.join("yarn.lock").exists() {
            package_managers.insert("yarn".to_string());
        }
        if dir.join("bun.lockb").exists() || dir.join("bun.lock").exists() {
            package_managers.insert("bun".to_string());
        }

        // 2. Rust
        let cargo_path = dir.join("Cargo.toml");
        if cargo_path.exists() {
            languages.insert("Rust".to_string());
            package_managers.insert("Cargo".to_string());
            if let Ok(content) = fs::read_to_string(&cargo_path) {
                if content.contains("tauri") {
                    frameworks.insert("Tauri".to_string());
                }
                if content.contains("axum") {
                    frameworks.insert("Axum".to_string());
                }
                if content.contains("actix-web") {
                    frameworks.insert("Actix Web".to_string());
                }
                if content.contains("rusqlite") || content.contains("sqlite") {
                    databases.insert("SQLite".to_string());
                }
                if content.contains("sqlx") {
                    databases.insert("SQLx".to_string());
                }
            }
        }

        // 3. PHP / Composer
        let composer_path = dir.join("composer.json");
        if composer_path.exists() {
            languages.insert("PHP".to_string());
            package_managers.insert("Composer".to_string());
            if let Ok(content) = fs::read_to_string(&composer_path) {
                if content.contains("laravel/framework") {
                    frameworks.insert("Laravel".to_string());
                }
                if content.contains("symfony/") {
                    frameworks.insert("Symfony".to_string());
                }
            }
        }

        // 4. Python
        if dir.join("pyproject.toml").exists()
            || dir.join("requirements.txt").exists()
            || dir.join("Pipfile").exists()
            || dir.join("setup.py").exists()
        {
            languages.insert("Python".to_string());
            if dir.join("poetry.lock").exists() {
                package_managers.insert("Poetry".to_string());
            } else if dir.join("Pipfile").exists() {
                package_managers.insert("Pipenv".to_string());
            } else {
                package_managers.insert("pip".to_string());
            }

            if let Ok(req) = fs::read_to_string(dir.join("requirements.txt")) {
                let req_lower = req.to_lowercase();
                if req_lower.contains("fastapi") {
                    frameworks.insert("FastAPI".to_string());
                }
                if req_lower.contains("django") {
                    frameworks.insert("Django".to_string());
                }
                if req_lower.contains("flask") {
                    frameworks.insert("Flask".to_string());
                }
            }
        }

        // 5. Go
        let go_mod = dir.join("go.mod");
        if go_mod.exists() {
            languages.insert("Go".to_string());
            package_managers.insert("go modules".to_string());
        }

        // 6. Java
        if dir.join("pom.xml").exists() {
            languages.insert("Java".to_string());
            package_managers.insert("Maven".to_string());
        }
        if dir.join("build.gradle").exists() || dir.join("build.gradle.kts").exists() {
            languages.insert("Java".to_string());
            package_managers.insert("Gradle".to_string());
        }

        // 7. Containers / Infrastructure
        if dir.join("Dockerfile").exists() {
            infrastructure.insert("Docker".to_string());
        }
        if dir.join("docker-compose.yml").exists() || dir.join("docker-compose.yaml").exists() {
            infrastructure.insert("Docker Compose".to_string());
        }

        let mut lang_vec: Vec<String> = languages.into_iter().collect();
        lang_vec.sort();
        let mut frame_vec: Vec<String> = frameworks.into_iter().collect();
        frame_vec.sort();
        let mut pm_vec: Vec<String> = package_managers.into_iter().collect();
        pm_vec.sort();
        let mut db_vec: Vec<String> = databases.into_iter().collect();
        db_vec.sort();
        let mut infra_vec: Vec<String> = infrastructure.into_iter().collect();
        infra_vec.sort();

        Ok(ScannedProjectContext {
            name,
            path: dir.to_string_lossy().to_string(),
            stack: DetectedStack {
                languages: lang_vec,
                frameworks: frame_vec,
                package_managers: pm_vec,
                databases: db_vec,
                infrastructure: infra_vec,
            },
            has_git,
        })
    }
}
