export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentStatus = 'connected' | 'not_detected' | 'disabled' | 'error';
export type PolicyRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'blocked';
export type PolicyDecision = 'allowed' | 'requires_approval' | 'blocked';

export interface GitContext {
  branch: string;
  isClean: boolean;
  ahead: number;
  behind: number;
  modifiedFiles: string[];
  addedFiles: string[];
  deletedFiles: string[];
  untrackedFiles: string[];
}

export interface DetectedStack {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  databases: string[];
  infrastructure: string[];
}

export interface ProjectContext {
  id: string;
  name: string;
  path: string;
  stack: DetectedStack;
  git?: GitContext;
  hasGit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCapability {
  coding: boolean;
  terminal: boolean;
  fileEditing: boolean;
  git: boolean;
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  executablePath?: string;
  version?: string;
  capabilities: AgentCapability;
  enabled: boolean;
  customPath?: string;
  authConfigured: boolean;
  statusMessage?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  agentId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ChangedFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
  additions?: number;
  deletions?: number;
}

export interface Execution {
  id: string;
  taskId?: string;
  projectId: string;
  agentId?: string;
  command: string;
  status: ExecutionStatus;
  exitCode?: number;
  durationMs?: number;
  filesChanged: ChangedFile[];
  gitDiff?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ExecutionEvent {
  id: number;
  executionId: string;
  eventType: 'stdout' | 'stderr' | 'status' | 'error' | 'exit';
  payload: string;
  createdAt: string;
}

export interface TerminalSession {
  sessionId: string;
  title: string;
  projectId: string;
  running: boolean;
  startedAt: string;
}

export interface CommandPolicy {
  allowedPrefixes: string[];
  blockedKeywords: string[];
  requireApprovalKeywords: string[];
}

export interface PolicyEvaluation {
  command: string;
  decision: PolicyDecision;
  riskLevel: PolicyRiskLevel;
  reason: string;
  matchedRule?: string;
}

export interface AppSettings {
  defaultProjectDirectory?: string;
  defaultShell: string;
  autoRefreshIntervalSeconds: number;
  requireApprovalForHighRisk: boolean;
  terminalFontSize: number;
  terminalCursorBlink: boolean;
  theme: 'dark' | 'light' | 'system';
}

export interface GitDiffResult {
  file: string;
  diff: string;
}

export interface GitCommitOptions {
  message: string;
  files?: string[];
  addAll?: boolean;
}

// --- Multi-Agent Team Orchestration Types ---
export type TeamRole = 'plan_manager' | 'developer' | 'tester';
export type WorkflowPhase = 'idle' | 'planning' | 'developing' | 'testing' | 'reviewing' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface TeamConfig {
  planManagerAgents?: string[];
  developerAgents?: string[];
  testerAgents?: string[];
  planManagerAgentId: string;
  planManagerFallbackAgentId?: string;
  developerAgentId: string;
  developerFallbackAgentId?: string;
  testerAgentId: string;
  testerFallbackAgentId?: string;
  maxRetries: number;
  autoPr: boolean;
  githubRepoUrl?: string;
}

export interface TeamWorkflowStep {
  id: string;
  workflowId: string;
  stepNumber: number;
  title: string;
  description: string;
  assignedRole: TeamRole;
  assignedAgentId: string;
  fallbackAgentUsed?: string;
  status: StepStatus;
  retryCount: number;
  testCommand?: string;
  verificationReport?: string;
  errorLog?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TeamWorkflow {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  isGreenfield: boolean;
  phase: WorkflowPhase;
  planManagerAgentId: string;
  planManagerFallback?: string;
  developerAgentId: string;
  developerFallback?: string;
  testerAgentId: string;
  testerFallback?: string;
  branchName?: string;
  prUrl?: string;
  prMethod?: 'api' | 'cli' | 'web';
  steps: TeamWorkflowStep[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface GitHubPrRequest {
  projectId: string;
  branchName: string;
  baseBranch?: string;
  title: string;
  body: string;
  githubRepoUrl?: string;
}

export interface GitHubPrResult {
  prUrl: string;
  method: 'api' | 'cli' | 'web';
  isWebFallback: boolean;
}
