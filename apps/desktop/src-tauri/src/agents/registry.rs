use std::collections::HashMap;
use std::sync::Arc;
use crate::database::DbManager;
use super::adapter::{AgentAdapter, AgentDetectionResult};
use super::claude::ClaudeAdapter;
use super::codex::CodexAdapter;
use super::opencode::OpenCodeAdapter;
use super::antigravity::AntigravityAdapter;

#[derive(Clone)]
pub struct AgentRegistry {
    adapters: HashMap<String, Arc<dyn AgentAdapter>>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            adapters: HashMap::new(),
        };

        registry.register(Arc::new(ClaudeAdapter::default()));
        registry.register(Arc::new(CodexAdapter::default()));
        registry.register(Arc::new(OpenCodeAdapter::default()));
        registry.register(Arc::new(AntigravityAdapter::default()));

        registry
    }

    pub fn register(&mut self, adapter: Arc<dyn AgentAdapter>) {
        self.adapters.insert(adapter.id().to_string(), adapter);
    }

    pub fn get_adapter(&self, id: &str) -> Option<Arc<dyn AgentAdapter>> {
        self.adapters.get(id).cloned()
    }

    pub fn list_adapters(&self) -> Vec<Arc<dyn AgentAdapter>> {
        self.adapters.values().cloned().collect()
    }

    pub async fn detect_all(&self, db: Option<&DbManager>) -> Vec<AgentDetectionResult> {
        let mut custom_paths: HashMap<String, String> = HashMap::new();
        if let Some(db_mgr) = db {
            if let Ok(agents) = db_mgr.list_agents() {
                for a in agents {
                    if let Some(p) = a.custom_path {
                        custom_paths.insert(a.id, p);
                    }
                }
            }
        }

        let mut results = Vec::new();
        for adapter in self.adapters.values() {
            let custom_path = custom_paths.get(adapter.id()).map(|s| s.as_str());
            let res = adapter.detect(custom_path).await;
            results.push(res);
        }

        results.sort_by(|a, b| a.name.cmp(&b.name));
        results
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}
