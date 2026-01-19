private async waitForConfirmation(): Promise<void> {
        // In VS Code, this would show a dialog
        const result = await vscode.window.showInformationMessage(
            'Continue autonomous execution?',
            'Continue',
            'Stop'
        );
        
        if (result !== 'Continue') {
            this.shouldStop = true;
        }
    }
}
```

---

# Part 4: Firebase Studio Integration

## 12. Why Firebase Studio

Firebase Studio (FBS) is the target deployment environment for Tideate because it provides:

1. **Built-in Preview** - Hot-reloading preview panel for immediate feedback
2. **Gemini Integration** - Native AI assistant for backend provisioning
3. **Emulator Suite** - Local Firebase services for development
4. **One-Click Deploy** - Seamless path from development to production

### Integration Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Studio Environment                   │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   VS Code       │  │   Preview       │  │   Gemini        │ │
│  │   (IDE Core)    │  │   (FBS Native)  │  │   (FBS Native)  │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │          │
│           └────────────────────┴────────────────────┘          │
│                               │                                 │
│                    ┌──────────▼──────────┐                     │
│                    │   Tideate IDE       │                     │
│                    │   Extension         │                     │
│                    └─────────────────────┘                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Firebase Emulators                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │
│  │  │   Auth   │  │Firestore │  │ Storage  │  │Functions │ │   │
│  │  │  :9099   │  │  :8080   │  │  :9199   │  │  :5001   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Preview Integration & Hot Reload

Tideate leverages Firebase Studio's built-in preview rather than building its own.

```typescript
// src/firebase/PreviewIntegration.ts

class PreviewIntegration {
    private previewFrame: any = null;
    private consoleMonitor: ConsoleMonitor;
    
    constructor() {
        this.consoleMonitor = new ConsoleMonitor();
    }
    
    /**
     * Open the Firebase Studio preview panel
     */
    async showPreview(): Promise<void> {
        await vscode.commands.executeCommand('firebase.openPreview');
    }
    
    /**
     * Refresh the preview after code changes
     */
    async reloadPreview(): Promise<void> {
        await vscode.commands.executeCommand('firebase.reloadPreview');
        
        // Wait for reload to complete
        await this.waitForPreviewReady();
    }
    
    /**
     * Get the preview frame for console monitoring
     */
    getPreviewFrame(): any {
        return this.previewFrame;
    }
    
    /**
     * Attach console monitor to preview
     */
    async attachConsoleMonitor(): Promise<ConsoleMonitor> {
        await this.consoleMonitor.attach(this.previewFrame);
        return this.consoleMonitor;
    }
    
    /**
     * Wait for preview to be ready
     */
    private async waitForPreviewReady(): Promise<void> {
        const maxWait = 10000; // 10 seconds
        const interval = 100;
        let waited = 0;
        
        while (waited < maxWait) {
            try {
                // Check if preview is responding
                const isReady = await this.checkPreviewReady();
                if (isReady) return;
            } catch {}
            
            await this.sleep(interval);
            waited += interval;
        }
        
        throw new Error('Preview failed to become ready');
    }
    
    private async checkPreviewReady(): Promise<boolean> {
        // Implementation depends on FBS preview API
        return true;
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### Hot Reload Coordinator

```typescript
// src/firebase/HotReloadCoordinator.ts

class HotReloadCoordinator {
    private watcher: fs.FSWatcher | null = null;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private readonly debounceMs = 500;
    
    constructor(
        private previewIntegration: PreviewIntegration,
        private runtimeErrorDetector: RuntimeErrorDetector
    ) {}
    
    /**
     * Start watching for file changes
     */
    startWatching(srcPath: string): void {
        this.watcher = fs.watch(srcPath, { recursive: true }, (event, filename) => {
            if (this.shouldTriggerReload(filename)) {
                this.scheduleReload();
            }
        });
    }
    
    /**
     * Stop watching
     */
    stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
    
    /**
     * Schedule a debounced reload
     */
    private scheduleReload(): void {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        this.debounceTimeout = setTimeout(async () => {
            await this.performReload();
        }, this.debounceMs);
    }
    
    /**
     * Perform the actual reload
     */
    private async performReload(): Promise<void> {
        console.log('[HotReload] Reloading preview...');
        
        // Clear previous errors
        this.runtimeErrorDetector.reset();
        
        // Reload preview
        await this.previewIntegration.reloadPreview();
        
        // Start monitoring for new errors
        await this.runtimeErrorDetector.startMonitoring();
    }
    
    private shouldTriggerReload(filename: string | null): boolean {
        if (!filename) return false;
        
        // Only reload for source file changes
        const reloadExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.html'];
        return reloadExtensions.some(ext => filename.endsWith(ext));
    }
}
```

---

## 14. Emulator Management

Tideate manages Firebase emulators for local development.

```typescript
// src/firebase/EmulatorManager.ts

interface EmulatorStatus {
    auth: boolean;
    firestore: boolean;
    storage: boolean;
    functions: boolean;
    uiUrl: string | null;
}

class EmulatorManager {
    private terminal: vscode.Terminal | null = null;
    private status: EmulatorStatus = {
        auth: false,
        firestore: false,
        storage: false,
        functions: false,
        uiUrl: null
    };
    
    /**
     * Start Firebase emulators
     */
    async startEmulators(): Promise<EmulatorStatus> {
        // Create or reuse terminal
        this.terminal = vscode.window.createTerminal({
            name: 'Firebase Emulators',
            cwd: vscode.workspace.rootPath
        });
        
        // Start emulators
        this.terminal.sendText('firebase emulators:start');
        this.terminal.show();
        
        // Wait for emulators to be ready
        await this.waitForEmulators();
        
        return this.status;
    }
    
    /**
     * Stop Firebase emulators
     */
    async stopEmulators(): Promise<void> {
        if (this.terminal) {
            this.terminal.sendText('\x03'); // Ctrl+C
            await this.sleep(1000);
            this.terminal.dispose();
            this.terminal = null;
        }
        
        this.status = {
            auth: false,
            firestore: false,
            storage: false,
            functions: false,
            uiUrl: null
        };
    }
    
    /**
     * Check emulator status
     */
    async checkStatus(): Promise<EmulatorStatus> {
        const checks = await Promise.all([
            this.checkPort(9099), // Auth
            this.checkPort(8080), // Firestore
            this.checkPort(9199), // Storage
            this.checkPort(5001), // Functions
            this.checkPort(4000)  // Emulator UI
        ]);
        
        this.status = {
            auth: checks[0],
            firestore: checks[1],
            storage: checks[2],
            functions: checks[3],
            uiUrl: checks[4] ? 'http://localhost:4000' : null
        };
        
        return this.status;
    }
    
    /**
     * Wait for emulators to be ready
     */
    private async waitForEmulators(): Promise<void> {
        const maxAttempts = 30;
        
        for (let i = 0; i < maxAttempts; i++) {
            const status = await this.checkStatus();
            
            // Consider ready if at least Firestore is up
            if (status.firestore) {
                console.log('[Emulators] Ready!');
                return;
            }
            
            await this.sleep(1000);
        }
        
        throw new Error('Emulators failed to start within timeout');
    }
    
    /**
     * Check if a port is listening
     */
    private async checkPort(port: number): Promise<boolean> {
        try {
            const response = await fetch(`http://localhost:${port}`, {
                method: 'GET',
                signal: AbortSignal.timeout(1000)
            });
            return true;
        } catch {
            return false;
        }
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

# Part 5: The Backend Intelligence Layer

## 15. Backend Requirements Tracker

The Backend Requirements Tracker silently analyzes frontend code to detect Firebase service usage.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Backend Requirements Tracker                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Code Analysis Engine                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ AST Parser   │  │  Pattern     │  │  Import      │   │   │
│  │  │              │  │  Matcher     │  │  Analyzer    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Requirements Accumulator                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │Firestore │ │   Auth   │ │ Storage  │ │Functions │   │   │
│  │  │Collections│ │Providers │ │  Paths   │ │Triggers  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Firebase Spec Generator                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Code Analysis Engine

```typescript
// src/backend/tracker/CodeAnalyzer.ts

interface AnalysisResult {
    firestoreCalls: FirestoreCall[];
    authCalls: AuthCall[];
    storageCalls: StorageCall[];
    functionCalls: FunctionCall[];
}

class CodeAnalyzer {
    private astParser: ASTParser;
    
    constructor() {
        this.astParser = new ASTParser();
    }
    
    /**
     * Analyze a file for Firebase usage
     */
    analyzeFile(filePath: string): AnalysisResult {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.analyzeCode(content, filePath);
    }
    
    /**
     * Analyze code string for Firebase usage
     */
    analyzeCode(code: string, filePath: string): AnalysisResult {
        const ast = this.astParser.parse(code, filePath);
        
        return {
            firestoreCalls: this.detectFirestoreCalls(ast),
            authCalls: this.detectAuthCalls(ast),
            storageCalls: this.detectStorageCalls(ast),
            functionCalls: this.detectFunctionCalls(ast)private formatChangelogEntry(result: TaskResult): string {
        const date = new Date().toISOString().split('T')[0];
        
        return `
## [${date}] - ${result.task.name}

### ✅ Completed
- ${result.task.description}

### 📁 Files Created
${result.filesCreated.map(f => `- ${f.path}`).join('\n') || '- None'}

### 📝 Files Modified
${result.filesModified.map(f => `- ${f.path}`).join('\n') || '- None'}

---
        `.trim();
    }
}
```

---

## 8. Finite State Machine & Gate Enforcement

The FSM ensures stages execute in order and gates cannot be bypassed.

### State Machine Definition

```typescript
// src/core/workflow/WorkflowFSM.ts

enum WorkflowState {
    IDLE = 'idle',
    PLANNING = 'planning',
    AWAITING_PLAN_GATE = 'awaiting_plan_gate',
    AUDITING = 'auditing',
    AWAITING_AUDIT_GATE = 'awaiting_audit_gate',
    EXECUTING = 'executing',
    AWAITING_EXECUTION_GATE = 'awaiting_execution_gate',
    DOCUMENTING = 'documenting',
    AWAITING_DOCUMENTATION_GATE = 'awaiting_documentation_gate',
    VERIFYING = 'verifying',
    SELF_CORRECTING = 'self_correcting',
    COMPLETE = 'complete',
    FAILED = 'failed'
}

enum WorkflowEvent {
    START_TASK = 'start_task',
    PLANNING_COMPLETE = 'planning_complete',
    PLAN_GATE_PASSED = 'plan_gate_passed',
    PLAN_GATE_FAILED = 'plan_gate_failed',
    AUDITING_COMPLETE = 'auditing_complete',
    AUDIT_GATE_PASSED = 'audit_gate_passed',
    AUDIT_GATE_FAILED = 'audit_gate_failed',
    EXECUTION_COMPLETE = 'execution_complete',
    EXECUTION_GATE_PASSED = 'execution_gate_passed',
    EXECUTION_GATE_FAILED = 'execution_gate_failed',
    DOCUMENTATION_COMPLETE = 'documentation_complete',
    DOCUMENTATION_GATE_PASSED = 'documentation_gate_passed',
    DOCUMENTATION_GATE_FAILED = 'documentation_gate_failed',
    VERIFICATION_PASSED = 'verification_passed',
    VERIFICATION_FAILED = 'verification_failed',
    CORRECTION_SUCCEEDED = 'correction_succeeded',
    CORRECTION_EXHAUSTED = 'correction_exhausted',
    RESET = 'reset'
}

class WorkflowFSM {
    private state: WorkflowState = WorkflowState.IDLE;
    private history: StateTransition[] = [];
    
    // Valid transitions map
    private readonly transitions: Map<WorkflowState, Map<WorkflowEvent, WorkflowState>> = new Map([
        [WorkflowState.IDLE, new Map([
            [WorkflowEvent.START_TASK, WorkflowState.PLANNING]
        ])],
        [WorkflowState.PLANNING, new Map([
            [WorkflowEvent.PLANNING_COMPLETE, WorkflowState.AWAITING_PLAN_GATE]
        ])],
        [WorkflowState.AWAITING_PLAN_GATE, new Map([
            [WorkflowEvent.PLAN_GATE_PASSED, WorkflowState.AUDITING],
            [WorkflowEvent.PLAN_GATE_FAILED, WorkflowState.FAILED]
        ])],
        [WorkflowState.AUDITING, new Map([
            [WorkflowEvent.AUDITING_COMPLETE, WorkflowState.AWAITING_AUDIT_GATE]
        ])],
        [WorkflowState.AWAITING_AUDIT_GATE, new Map([
            [WorkflowEvent.AUDIT_GATE_PASSED, WorkflowState.EXECUTING],
            [WorkflowEvent.AUDIT_GATE_FAILED, WorkflowState.PLANNING] // Re-plan
        ])],
        [WorkflowState.EXECUTING, new Map([
            [WorkflowEvent.EXECUTION_COMPLETE, WorkflowState.AWAITING_EXECUTION_GATE]
        ])],
        [WorkflowState.AWAITING_EXECUTION_GATE, new Map([
            [WorkflowEvent.EXECUTION_GATE_PASSED, WorkflowState.DOCUMENTING],
            [WorkflowEvent.EXECUTION_GATE_FAILED, WorkflowState.FAILED]
        ])],
        [WorkflowState.DOCUMENTING, new Map([
            [WorkflowEvent.DOCUMENTATION_COMPLETE, WorkflowState.AWAITING_DOCUMENTATION_GATE]
        ])],
        [WorkflowState.AWAITING_DOCUMENTATION_GATE, new Map([
            [WorkflowEvent.DOCUMENTATION_GATE_PASSED, WorkflowState.VERIFYING],
            [WorkflowEvent.DOCUMENTATION_GATE_FAILED, WorkflowState.FAILED]
        ])],
        [WorkflowState.VERIFYING, new Map([
            [WorkflowEvent.VERIFICATION_PASSED, WorkflowState.COMPLETE],
            [WorkflowEvent.VERIFICATION_FAILED, WorkflowState.SELF_CORRECTING]
        ])],
        [WorkflowState.SELF_CORRECTING, new Map([
            [WorkflowEvent.CORRECTION_SUCCEEDED, WorkflowState.VERIFYING],
            [WorkflowEvent.CORRECTION_EXHAUSTED, WorkflowState.FAILED]
        ])],
        [WorkflowState.COMPLETE, new Map([
            [WorkflowEvent.RESET, WorkflowState.IDLE]
        ])],
        [WorkflowState.FAILED, new Map([
            [WorkflowEvent.RESET, WorkflowState.IDLE]
        ])]
    ]);
    
    /**
     * Attempt a state transition
     */
    transition(event: WorkflowEvent): boolean {
        const currentTransitions = this.transitions.get(this.state);
        
        if (!currentTransitions) {
            console.error(`No transitions defined for state: ${this.state}`);
            return false;
        }
        
        const nextState = currentTransitions.get(event);
        
        if (!nextState) {
            console.error(`Invalid transition: ${this.state} + ${event}`);
            return false;
        }
        
        // Record transition
        this.history.push({
            from: this.state,
            to: nextState,
            event,
            timestamp: new Date()
        });
        
        console.log(`[FSM] ${this.state} → ${nextState} (${event})`);
        this.state = nextState;
        
        return true;
    }
    
    getState(): WorkflowState {
        return this.state;
    }
    
    getHistory(): StateTransition[] {
        return [...this.history];
    }
    
    canTransition(event: WorkflowEvent): boolean {
        const currentTransitions = this.transitions.get(this.state);
        return currentTransitions?.has(event) ?? false;
    }
}
```

### Gate Enforcer

```typescript
// src/core/workflow/GateEnforcer.ts

class GateEnforcer {
    constructor(
        private validator: DocumentValidator,
        private verificationPipeline: VerificationPipeline
    ) {}
    
    /**
     * Gate 1: Validate execution plan
     */
    async enforceGate1(plan: ExecutionPlan): Promise<GateResult> {
        const issues: string[] = [];
        
        // Check plan has objective
        if (!plan.objective || plan.objective.length < 10) {
            issues.push('Plan objective is missing or too short');
        }
        
        // Check plan has steps
        if (!plan.steps || plan.steps.length === 0) {
            issues.push('Plan has no execution steps');
        }
        
        // Check each step is valid
        for (const step of plan.steps || []) {
            if (!step.type || !step.description) {
                issues.push(`Step ${step.id} is missing type or description`);
            }
        }
        
        // Check rollback strategy
        if (!plan.rollbackStrategy) {
            issues.push('Plan has no rollback strategy');
        }
        
        return {
            passed: issues.length === 0,
            issues
        };
    }
    
    /**
     * Gate 2: Validate audit results
     */
    async enforceGate2(audit: AuditReport): Promise<GateResult> {
        if (audit.approval === 'approved') {
            return { passed: true, issues: [] };
        }
        
        if (audit.approval === 'conditional' && audit.autoFixable) {
            return { 
                passed: true, 
                issues: audit.issues.map(i => i.message),
                autoFixed: true
            };
        }
        
        return {
            passed: false,
            issues: audit.issues.map(i => i.message)
        };
    }
    
    /**
     * Gate 3: Validate code execution
     */
    async enforceGate3(result: TaskResult): Promise<GateResult> {
        const issues: string[] = [];
        
        // Check for execution errors
        if (result.errors.length > 0) {
            issues.push(...result.errors);
        }
        
        // Check that expected files were created
        for (const file of result.filesCreated) {
            if (!fs.existsSync(file.path)) {
                issues.push(`Expected file not created: ${file.path}`);
            }
        }
        
        // Basic syntax check on created files
        for (const file of result.filesCreated) {
            if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
                const syntaxResult = await this.checkSyntax(file.path);
                if (!syntaxResult.valid) {
                    issues.push(`Syntax error in ${file.path}: ${syntaxResult.error}`);
                }
            }
        }
        
        return {
            passed: issues.length === 0,
            issues
        };
    }
    
    /**
     * Gate 4: Validate documentation updates
     */
    async enforceGate4(docs: DocumentationResult): Promise<GateResult> {
        const issues: string[] = [];
        
        if (!docs.success) {
            issues.push('Documentation update failed');
        }
        
        // Validate changelog
        const changelogResult = await this.validator.validateChangelog();
        if (!changelogResult.valid) {
            issues.push(`Changelog validation failed: ${changelogResult.reason}`);
        }
        
        // Validate checklist
        const checklistResult = await this.validator.validateChecklist();
        if (!checklistResult.valid) {
            issues.push(`Checklist validation failed: ${checklistResult.reason}`);
        }
        
        return {
            passed: issues.length === 0,
            issues
        };
    }
    
    /**
     * Gate 5: Run verification pipeline
     */
    async enforceGate5(): Promise<GateResult> {
        const report = await this.verificationPipeline.runAll();
        
        const issues: string[] = [];
        
        if (!report.typescript.passed) {
            issues.push('TypeScript compilation failed');
        }
        
        if (!report.eslint.passed) {
            const errorCount = report.eslint.errors.filter(e => e.severity === 'error').length;
            issues.push(`ESLint found ${errorCount} error(s)`);
        }
        
        if (!report.tests.passed) {
            issues.push(`${report.tests.failed} test(s) failed`);
        }
        
        if (!report.build.passed) {
            issues.push('Build failed');
        }
        
        if (!report.documentation.passed) {
            issues.push('Documentation integrity check failed');
        }
        
        return {
            passed: report.passed,
            issues,
            report
        };
    }
    
    private async checkSyntax(filePath: string): Promise<{ valid: boolean; error?: string }> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Use TypeScript compiler API for syntax check
            const result = ts.transpileModule(content, {
                compilerOptions: { module: ts.ModuleKind.ESNext }
            });
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}
```

---

## 9. Context Resolution System

The Context Resolution system enables @mentions to reference project documents.

### Configuration

```json
// .tideate/context.json
{
    "version": "1.0.0",
    "mappings": {
        "@ProductVision": "product-vision.md",
        "@TechnicalSpec": "technical-spec.md",
        "@DesignTokens": "design-tokens.json",
        "@APISchema": "api-schema.yaml",
        "@DatabaseSchema": "database-schema.sql",
        "@SecurityPolicy": "security-policy.md",
        "@Checklist": "../AGENTS.md/checklist.md"
    }
}
```

### Context Resolver

```typescript
// src/core/context/ContextResolver.ts

interface ContextItem {
    mention: string;
    path: string;
    content: string;
    type: 'file' | 'section' | 'variable';
}

class ContextResolver {
    private contextMap: Map<string, string>;
    private tideateRoot: string;
    
    constructor(workspaceRoot: string) {
        this.tideateRoot = path.join(workspaceRoot, '.tideate');
        this.contextMap = this.buildContextMap();
    }
    
    private buildContextMap(): Map<string, string> {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const map = new Map<string, string>();
        
        for (const [mention, filePath] of Object.entries(config.mappings)) {
            map.set(mention, filePath as string);
        }
        
        return map;
    }
    
    /**
     * Resolve a single @mention to file content
     * DETERMINISTIC: No AI involvement, direct file read
     */
    resolve(mention: string): ContextItem {
        const relativePath = this.contextMap.get(mention);
        
        if (!relativePath) {
            throw new ContextResolutionError(`Unknown mention: ${mention}`);
        }
        
        const fullPath = relativePath.startsWith('..')
            ? path.resolve(this.tideateRoot, relativePath)
            : path.join(this.tideateRoot, relativePath);
        
        if (!fs.existsSync(fullPath)) {
            throw new ContextResolutionError(`File not found: ${fullPath}`);
        }
        
        // Read raw content - NO AI PROCESSING
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        return {
            mention,
            path: fullPath,
            content,
            type: 'file'
        };
    }
    
    /**
     * Resolve multiple @mentions
     */
    resolveAll(mentions: string[]): ContextItem[] {
        return mentions.map(m => this.resolve(m));
    }
    
    /**
     * Extract @mentions from text
     */
    extractMentions(text: string): string[] {
        const pattern = /@\w+/g;
        const matches = text.match(pattern) || [];
        return [...new Set(matches)];
    }
    
    /**
     * Format contexts for injection into AI prompt
     */
    formatForPrompt(contexts: ContextItem[]): string {
        return contexts.map(ctx => `
# Context: ${ctx.mention}
# Source: ${ctx.path}

${ctx.content}

---
`).join('\n');
    }
    
    /**
     * Get all available mentions
     */
    getAvailableMentions(): string[] {
        return Array.from(this.contextMap.keys());
    }
}

class ContextResolutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContextResolutionError';
    }
}
```

---

## 10. Multi-Agent Coordination

The system uses multiple specialized AI agents coordinated by an orchestrator.

### Agent Responsibilities

| Agent | Role | Input | Output |
|-------|------|-------|--------|
| Planning | Create execution plans | Task + Context | ExecutionPlan |
| Auditing | Review plans for issues | Plan | AuditReport |
| Execution | Generate/modify code | Approved Plan | TaskResult |
| Documentation | Update changelog/checklist | TaskResult | DocumentationResult |

### Orchestrator

```typescript
// src/core/workflow/WorkflowOrchestrator.ts

class WorkflowOrchestrator {
    private fsm: WorkflowFSM;
    private gateEnforcer: GateEnforcer;
    private planningAgent: PlanningAgent;
    private auditingAgent: AuditingAgent;
    private executionAgent: ExecutionAgent;
    private documentationAgent: DocumentationAgent;
    private selfCorrectionLoop: SelfCorrectionLoop;
    private contextResolver: ContextResolver;
    private snapshotManager: SnapshotManager;
    
    constructor(deps: OrchestratorDependencies) {
        this.fsm = deps.fsm;
        this.gateEnforcer = deps.gateEnforcer;
        this.planningAgent = deps.planningAgent;
        this.auditingAgent = deps.auditingAgent;
        this.executionAgent = deps.executionAgent;
        this.documentationAgent = deps.documentationAgent;
        this.selfCorrectionLoop = deps.selfCorrectionLoop;
        this.contextResolver = deps.contextResolver;
        this.snapshotManager = deps.snapshotManager;
    }
    
    /**
     * Execute a complete task through all stages
     */
    async executeTask(task: Task): Promise<WorkflowResult> {
        // Create snapshot before starting
        const snapshotId = await this.snapshotManager.create('pre-task');
        
        try {
            // Stage 1: Planning
            this.fsm.transition(WorkflowEvent.START_TASK);
            const contexts = this.resolveTaskContexts(task);
            const plan = await this.planningAgent.createPlan(task, contexts);
            this.fsm.transition(WorkflowEvent.PLANNING_COMPLETE);
            
            // Gate 1
            const gate1 = await this.gateEnforcer.enforceGate1(plan);
            if (!gate1.passed) {
                this.fsm.transition(WorkflowEvent.PLAN_GATE_FAILED);
                throw new GateError('Gate 1', gate1.issues);
            }
            this.fsm.transition(WorkflowEvent.PLAN_GATE_PASSED);
            
            // Stage 2: Auditing
            const audit = await this.auditingAgent.review(plan);
            this.fsm.transition(WorkflowEvent.AUDITING_COMPLETE);
            
            // Gate 2
            const gate2 = await this.gateEnforcer.enforceGate2(audit);
            if (!gate2.passed) {
                this.fsm.transition(WorkflowEvent.AUDIT_GATE_FAILED);
                // Re-planning will happen on next attempt
                throw new GateError('Gate 2', gate2.issues);
            }
            this.fsm.transition(WorkflowEvent.AUDIT_GATE_PASSED);
            
            // Stage 3: Execution
            const result = await this.executionAgent.execute(plan);
            this.fsm.transition(WorkflowEvent.EXECUTION_COMPLETE);
            
            // Gate 3
            const gate3 = await this.gateEnforcer.enforceGate3(result);
            if (!gate3.passed) {
                this.fsm.transition(WorkflowEvent.EXECUTION_GATE_FAILED);
                throw new GateError('Gate 3', gate3.issues);
            }
            this.fsm.transition(WorkflowEvent.EXECUTION_GATE_PASSED);
            
            // Stage 4: Documentation
            const docs = await this.documentationAgent.updateDocumentation(result);
            this.fsm.transition(WorkflowEvent.DOCUMENTATION_COMPLETE);
            
            // Gate 4
            const gate4 = await this.gateEnforcer.enforceGate4(docs);
            if (!gate4.passed) {
                this.fsm.transition(WorkflowEvent.DOCUMENTATION_GATE_FAILED);
                throw new GateError('Gate 4', gate4.issues);
            }
            this.fsm.transition(WorkflowEvent.DOCUMENTATION_GATE_PASSED);
            
            // Stage 5: Verification + Self-Correction
            const correctionResult = await this.selfCorrectionLoop.verifyAndCorrect(result);
            
            if (correctionResult.success) {
                this.fsm.transition(WorkflowEvent.VERIFICATION_PASSED);
                return {
                    success: true,
                    task,
                    result: correctionResult.finalResult,
                    attempts: correctionResult.attempts
                };
            } else {
                this.fsm.transition(WorkflowEvent.CORRECTION_EXHAUSTED);
                throw new Error(correctionResult.message);
            }
            
        } catch (error) {
            // Rollback to snapshot on failure
            await this.snapshotManager.restore(snapshotId);
            
            return {
                success: false,
                task,
                error: error.message,
                rollbackPerformed: true
            };
        }
    }
    
    private resolveTaskContexts(task: Task): ContextItem[] {
        const mentions = this.contextResolver.extractMentions(task.description);
        return this.contextResolver.resolveAll(mentions);
    }
}
```

---

## 11. Checklist Execution & Autonomous Mode

The Checklist Executor processes feature checklists and supports autonomous multi-task execution.

### Checklist Parser

```typescript
// src/core/workflow/ChecklistParser.ts

interface ChecklistItem {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    subtasks: ChecklistItem[];
    acceptanceCriteria: string[];
    priority: 'high' | 'medium' | 'low';
    phase: string;
}

class ChecklistParser {
    /**
     * Parse a markdown checklist into structured items
     */
    parse(markdown: string): ChecklistItem[] {
        const lines = markdown.split('\n');
        const items: ChecklistItem[] = [];
        let currentItem: ChecklistItem | null = null;
        let currentPhase = 'Phase 1';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Phase header
            const phaseMatch = line.match(/^##\s+Phase\s+(\d+)/i);
            if (phaseMatch) {
                currentPhase = `Phase ${phaseMatch[1]}`;
                continue;
            }
            
            // Main checkbox item
            const checkboxMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/i);
            if (checkboxMatch) {
                if (currentItem) {
                    items.push(currentItem);
                }
                
                currentItem = {
                    id: `item-${items.length + 1}`,
                    title: checkboxMatch[2].trim(),
                    description: '',
                    completed: checkboxMatch[1].toLowerCase() === 'x',
                    subtasks: [],
                    acceptanceCriteria: [],
                    priority: 'medium',
                    phase: currentPhase
                };
                continue;
            }
            
            // Subtask (indented checkbox)
            const subtaskMatch = line.match(/^\s+-\s+\[([ x])\]\s+(.+)/i);
            if (subtaskMatch && currentItem) {
                currentItem.subtasks.push({
                    id: `${currentItem.id}-sub-${currentItem.subtasks.length + 1}`,
                    title: subtaskMatch[2].trim(),
                    description: '',
                    completed: subtaskMatch[1].toLowerCase() === 'x',
                    subtasks: [],
                    acceptanceCriteria: [],
                    priority: 'medium',
                    phase: currentPhase
                });
                continue;
            }
            
            // Acceptance criteria
            const criteriaMatch = line.match(/^\s+-\s+Acceptance:\s+(.+)/i);
            if (criteriaMatch && currentItem) {
                currentItem.acceptanceCriteria.push(criteriaMatch[1].trim());
                continue;
            }
            
            // Description (indented text)
            if (line.match(/^\s+-\s+/) && currentItem && !subtaskMatch) {
                currentItem.description += line.replace(/^\s+-\s+/, '') + ' ';
            }
        }
        
        if (currentItem) {
            items.push(currentItem);
        }
        
        return items;
    }
    
    /**
     * Get next uncompleted item
     */
    getNextUncompleted(items: ChecklistItem[]): ChecklistItem | null {
        for (const item of items) {
            if (!item.completed) {
                return item;
            }
        }
        return null;
    }
    
    /**
     * Calculate progress
     */
    calculateProgress(items: ChecklistItem[]): Progress {
        const total = items.length;
        const completed = items.filter(i => i.completed).length;
        
        const byPhase: Record<string, { total: number; completed: number }> = {};
        
        for (const item of items) {
            if (!byPhase[item.phase]) {
                byPhase[item.phase] = { total: 0, completed: 0 };
            }
            byPhase[item.phase].total++;
            if (item.completed) {
                byPhase[item.phase].completed++;
            }
        }
        
        return {
            overall: { total, completed, percentage: Math.round((completed / total) * 100) },
            byPhase
        };
    }
}
```

### Autonomous Executor

```typescript
// src/core/workflow/AutonomousExecutor.ts

interface AutonomousConfig {
    pauseBetweenTasks: boolean;
    pauseDuration: number; // ms
    maxConsecutiveTasks: number;
    stopOnFailure: boolean;
    requireConfirmation: boolean;
}

class AutonomousExecutor {
    private isRunning = false;
    private shouldStop = false;
    private currentTaskIndex = 0;
    
    constructor(
        private orchestrator: WorkflowOrchestrator,
        private checklistParser: ChecklistParser,
        private checklistManager: ChecklistManager,
        private config: AutonomousConfig
    ) {}
    
    /**
     * Start autonomous execution of checklist
     */
    async start(): Promise<AutonomousResult> {
        if (this.isRunning) {
            throw new Error('Autonomous execution already in progress');
        }
        
        this.isRunning = true;
        this.shouldStop = false;
        
        const results: TaskResult[] = [];
        let consecutiveCount = 0;
        
        try {
            while (!this.shouldStop) {
                // Parse current checklist state
                const checklistContent = await this.checklistManager.read();
                const items = this.checklistParser.parse(checklistContent);
                
                // Get next uncompleted item
                const nextItem = this.checklistParser.getNextUncompleted(items);
                
                if (!nextItem) {
                    console.log('[Autonomous] All tasks complete!');
                    break;
                }
                
                // Check consecutive limit
                if (consecutiveCount >= this.config.maxConsecutiveTasks) {
                    console.log('[Autonomous] Reached max consecutive tasks, pausing');
                    if (this.config.requireConfirmation) {
                        await this.waitForConfirmation();
                    }
                    consecutiveCount = 0;
                }
                
                // Convert checklist item to task
                const task = this.itemToTask(nextItem);
                
                console.log(`[Autonomous] Starting task: ${task.name}`);
                
                // Execute task through orchestrator
                const result = await this.orchestrator.executeTask(task);
                results.push(result);
                
                if (!result.success) {
                    console.log(`[Autonomous] Task failed: ${result.error}`);
                    if (this.config.stopOnFailure) {
                        break;
                    }
                }
                
                consecutiveCount++;
                
                // Pause between tasks if configured
                if (this.config.pauseBetweenTasks && !this.shouldStop) {
                    console.log(`[Autonomous] Pausing for ${this.config.pauseDuration}ms`);
                    await this.sleep(this.config.pauseDuration);
                }
            }
        } finally {
            this.isRunning = false;
        }
        
        return {
            tasksAttempted: results.length,
            tasksSucceeded: results.filter(r => r.success).length,
            tasksFailed: results.filter(r => !r.success).length,
            results,
            stoppedByUser: this.shouldStop
        };
    }
    
    /**
     * Stop autonomous execution
     */
    stop(): void {
        this.shouldStop = true;
    }
    
    /**
     * Check if currently running
     */
    isExecuting(): boolean {
        return this.isRunning;
    }
    
    private itemToTask(item: ChecklistItem): Task {
        return {
            id: item.id,
            name: item.title,
            description: item.description || item.title,
            checklistItem: item.id,
            acceptanceCriteria: item.acceptanceCriteria
        };
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    private async waitForConfirmation(): Promise<void> {
        // In VS Code, this would show a dialog
        const result = await vscode.window.showInformationMessage(
            'Continue autonomous execution?',
            'Continue',
            'Stop'
        );
        
        if (result !== 'Continue') {
            this.shouldStop = true;
        }
    }
}Path = path.join(this.tideateRoot, 'context.json');
        
        if (!fs.existsSync(configPath)) {
            return new Map();
        }
        
        const config# Tideate IDE - Unified Technical Design Document

**Version:** 2.0  
**Date:** January 2026  
**Platform:** VS Code Extension (Firebase Studio Compatible)  
**Base:** Cline Fork  
**Status:** Pre-Development

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial TDD - Core workflow architecture |
| 1.0-A1 | Jan 2026 | Addendum: Backend Requirements Tracker |
| 1.0-A2 | Jan 2026 | Addendum: Backend Verification Layer |
| 1.0-A3 | Jan 2026 | Addendum: Self-Correction Loop |
| **2.0** | **Jan 2026** | **Unified TDD - Consolidated all addendums, restructured around core innovation** |

---

## Table of Contents

### Part 1: The Core Innovation
1. [Executive Summary](#1-executive-summary)
2. [The Discovery: Why This Works](#2-the-discovery-why-this-works)
3. [Value Proposition](#3-value-proposition)

### Part 2: The Verification-First Architecture
4. [System Architecture Overview](#4-system-architecture-overview)
5. [The Self-Correction Loop](#5-the-self-correction-loop)
6. [Deterministic Verification Pipeline](#6-deterministic-verification-pipeline)

### Part 3: The Workflow Engine
7. [Five-Stage Sequential Workflow](#7-five-stage-sequential-workflow)
8. [Finite State Machine & Gate Enforcement](#8-finite-state-machine--gate-enforcement)
9. [Context Resolution System](#9-context-resolution-system)
10. [Multi-Agent Coordination](#10-multi-agent-coordination)
11. [Checklist Execution & Autonomous Mode](#11-checklist-execution--autonomous-mode)

### Part 4: Firebase Studio Integration
12. [Why Firebase Studio](#12-why-firebase-studio)
13. [Preview Integration & Hot Reload](#13-preview-integration--hot-reload)
14. [Emulator Management](#14-emulator-management)

### Part 5: The Backend Intelligence Layer
15. [Backend Requirements Tracker](#15-backend-requirements-tracker)
16. [Firebase Spec Generation](#16-firebase-spec-generation)
17. [Gemini Handoff System](#17-gemini-handoff-system)
18. [Provisioning Verification & Rollback](#18-provisioning-verification--rollback)

### Part 6: Implementation Details
19. [Unified Data Models](#19-unified-data-models)
20. [User Interface Specifications](#20-user-interface-specifications)
21. [API Specifications](#21-api-specifications)
22. [Security & Privacy](#22-security--privacy)

### Part 7: Operations
23. [Testing Strategy](#23-testing-strategy)
24. [Performance Requirements](#24-performance-requirements)
25. [Deployment & Distribution](#25-deployment--distribution)
26. [Development Roadmap](#26-development-roadmap)

### Appendices
- [A. Configuration Schema](#appendix-a-configuration-schema)
- [B. Glossary](#appendix-b-glossary)
- [C. Build Prompts Reference](#appendix-c-build-prompts-reference)

---

# Part 1: The Core Innovation

## 1. Executive Summary

### Project Overview

Tideate IDE is a VS Code extension that implements **Verified AI Development**—a multi-stage workflow system with deterministic verification gates and self-correction capabilities that make AI coding trustworthy for production use.

### The Problem

Current AI coding assistants (Copilot, Cursor, Cline) use **single-prompt optimistic execution**:

```
User Request → AI Generates Code → Hope It Works
```

This approach fails because:
- AI hallucinates functions that don't exist
- Generated code often has subtle bugs
- No verification before "completion"
- Documentation drifts from reality
- Users become bottleneck for error detection

### The Solution

Tideate implements a **verification-first architecture** with **automatic self-correction**:

```
User Request → Plan → Audit → Execute → Document → Verify → Self-Correct (if needed) → Done
```

Key innovations:
1. **Self-Correction Loop** - AI verifies its own work and fixes issues automatically
2. **Deterministic Gates** - Software-enforced checkpoints between stages
3. **Documentation Integrity** - Mathematical proofs that docs are preserved
4. **Backend Intelligence** - Automatic Firebase spec generation from frontend code

### Technical Foundation

- **Base:** Fork of Cline (formerly Claude Dev)
- **Platform:** VS Code Extension
- **Target Environment:** Firebase Studio
- **Primary Language:** TypeScript
- **Runtime:** Node.js 18+
- **Extension API:** VS Code Extension API v1.85+

### Core Capabilities

| Capability | Description |
|------------|-------------|
| Sequential Workflow | 5 stages with mandatory gates |
| Self-Correction | Automatic error detection and retry (up to 3x) |
| Deterministic Guards | FSM, validation, CI/CD checks |
| Checklist Execution | Parse and execute feature checklists |
| Autonomous Mode | Run multiple tasks with configurable pauses |
| Backend Tracking | Silent accumulation of Firebase requirements |
| Gemini Handoff | One-click backend provisioning |
| Documentation Integrity | Append-only logs, line count validation |

---

## 2. The Discovery: Why This Works

### The Origin Story

The Tideate workflow was discovered through extensive use of Google AI Studio's Build mode combined with carefully crafted "Build Prompts." The combination achieved remarkable reliability—features built correctly on first attempt, documentation stayed in sync, and errors were caught before reporting completion.

The question emerged: **Why does this work when other AI coding tools don't?**

### The Secret Ingredient: Self-Correction

Analysis revealed that AI Studio Builder's reliability comes from a **self-correction loop** that:

1. **Verifies its own work automatically** - Doesn't just write code and report done
2. **Detects runtime errors in preview** - Watches the console for exceptions
3. **Fixes issues proactively** - Without waiting for user intervention
4. **Ensures code-documentation consistency** - Checks that what's documented exists
5. **Only reports "Complete" when everything actually works** - Honest completion status

### The Manual Workflow That Worked

Before productization, the workflow looked like this:

```
┌─────────────────────────────────────────────────────────────┐
│                    OVERSEER (Claude)                        │
│  • Product Vision Document                                  │
│  • Technical Design Document                                │
│  • Generate Build Prompts                                   │
│  • Quality Gate Reviews                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  BUILDER (AI Studio)                        │
│  • Receive prompt with READ-ONLY docs mode                  │
│  • Identify next feature from checklist                     │
│  • Implement feature                                        │
│  • Self-verify (AI Studio's hidden magic)                   │
│  • Report completion                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 DOCUMENTATION (Separate)                    │
│  • Explicit WRITE mode prompt                               │
│  • Update checklist (mark [x])                              │
│  • Update changelog (append only)                           │
│  • Verify line counts                                       │
└─────────────────────────────────────────────────────────────┘
```

### What We're Productizing

Tideate IDE encodes this entire workflow into software:

| Manual Step | Tideate Automation |
|-------------|-------------------|
| Overseer generates prompts | Planning Agent + Context Resolution |
| Builder executes carefully | Execution Agent + FSM gates |
| AI Studio self-corrects | Self-Correction Loop (explicit) |
| Separate docs update | Documentation Integrity System |
| User verifies completion | Deterministic Verification Pipeline |
| Manual version control | Automatic snapshots + rollback |

### The Bi-Directional Context Loop

The real power comes from **context that flows both directions**:

```
Strategy (Command Center)
    ↓ Product Vision, TDD, Checklist
    ↓
Implementation (IDE) ←──────────────────┐
    ↓ Code, Errors, Completion Status   │
    ↓                                   │
Operations (Backend Intelligence)       │
    ↓ Requirements, Specs, Provisioning │
    │                                   │
    └───────────────────────────────────┘
         Feedback: What was built, 
         what failed, what's needed
```

This loop is why a solo founder using Tideate can be as effective as a 5-person team.

---

## 3. Value Proposition

### For Non-Technical Founders

| Pain Point | Tideate Solution |
|------------|------------------|
| AI code doesn't work | Self-correction ensures it does before reporting done |
| Don't know if AI is lying | Deterministic verification proves correctness |
| Backend is overwhelming | Build frontend first, backend specs accumulate automatically |
| Context gets lost | @mentions resolve to actual files, every time |
| Documentation drifts | Integrity system mathematically prevents corruption |

### For Technical Founders

| Pain Point | Tideate Solution |
|------------|------------------|
| AI skips error handling | Audit stage catches architectural gaps |
| Optimistic completion reports | Verification pipeline runs actual tests |
| Can't trust autonomous mode | Gates physically prevent invalid transitions |
| Backend provisioning errors | Deterministic verification + rollback |

### The Founding Team Replacement

Tideate replaces the need for multiple roles:

| Role | How Tideate Replaces |
|------|---------------------|
| Product Manager | Context Resolution (@ProductVision always available) |
| Tech Lead | Auditing Agent reviews every plan |
| QA Engineer | Self-Correction Loop + Verification Pipeline |
| DevOps | Backend Tracker + Gemini Handoff |
| Documentation | Integrity System enforces consistency |

### Success Metrics

| Metric | Target |
|--------|--------|
| First-attempt success rate | >80% (vs ~40% for optimistic AI) |
| Documentation corruption | <1% |
| Self-correction resolution | >90% of caught errors |
| User intervention required | <20% of tasks |
| Time to backend provisioning | <5 minutes from "ready" |

---

# Part 2: The Verification-First Architecture

## 4. System Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         TIDEATE IDE EXTENSION                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    VERIFICATION LAYER (Core)                     │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │  │
│  │  │ Self-Correction │  │    Holistic      │  │  Deterministic │  │  │
│  │  │     Loop        │  │   Consistency    │  │   Verification │  │  │
│  │  │                 │  │    Checker       │  │    Pipeline    │  │  │
│  │  └────────┬────────┘  └────────┬─────────┘  └───────┬────────┘  │  │
│  │           └───────────────┬────┴─────────────────────┘          │  │
│  │                           │                                      │  │
│  │                  ┌────────▼────────┐                             │  │
│  │                  │  Verification   │                             │  │
│  │                  │  Orchestrator   │                             │  │
│  │                  └─────────────────┘                             │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────▼───────────────────────────────┐  │
│  │                      WORKFLOW ENGINE                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ Planning │→ │ Auditing │→ │Execution │→ │  Documentation   │ │  │
│  │  │  Agent   │  │  Agent   │  │  Agent   │  │     Agent        │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │  │
│  │        │             │            │               │              │  │
│  │        └─────────────┴────────────┴───────────────┘              │  │
│  │                           │                                      │  │
│  │                  ┌────────▼────────┐                             │  │
│  │                  │  Workflow FSM   │                             │  │
│  │                  │ (Gate Enforcer) │                             │  │
│  │                  └─────────────────┘                             │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────▼───────────────────────────────┐  │
│  │                   BACKEND INTELLIGENCE                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │  │
│  │  │  Code        │  │   Spec       │  │      Gemini            │ │  │
│  │  │  Analyzer    │→ │  Generator   │→ │      Handoff           │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │  │
│  │                                              │                   │  │
│  │                              ┌───────────────▼────────────────┐  │  │
│  │                              │  Provisioning Verifier         │  │  │
│  │                              │  (+ Rollback System)           │  │  │
│  │                              └────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────▼───────────────────────────────┐  │
│  │                   FIREBASE STUDIO INTEGRATION                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │  │
│  │  │   Preview    │  │   Emulator   │  │     Runtime Error      │ │  │
│  │  │  Integration │  │   Manager    │  │      Detector          │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                         CONTEXT & STORAGE                              │
│  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────────┐ │
│  │ Context Resolver │  │ Snapshot Manager  │  │ Documentation Store │ │
│  │  (@mentions)     │  │   (Rollback)      │  │  (Integrity)        │ │
│  └──────────────────┘  └───────────────────┘  └─────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
src/
├── core/
│   ├── verification/           # THE CORE INNOVATION
│   │   ├── SelfCorrectionLoop.ts
│   │   ├── HolisticChecker.ts
│   │   ├── VerificationPipeline.ts
│   │   ├── VerificationOrchestrator.ts
│   │   └── RuntimeErrorDetector.ts
│   │
│   ├── workflow/               # The Workflow Engine
│   │   ├── WorkflowFSM.ts
│   │   ├── GateEnforcer.ts
│   │   ├── WorkflowOrchestrator.ts
│   │   └── ChecklistExecutor.ts
│   │
│   ├── agents/                 # Multi-Agent System
│   │   ├── PlanningAgent.ts
│   │   ├── AuditingAgent.ts
│   │   ├── ExecutionAgent.ts
│   │   └── DocumentationAgent.ts
│   │
│   ├── context/                # Context Resolution
│   │   ├── ContextResolver.ts
│   │   └── MentionParser.ts
│   │
│   └── documents/              # Documentation Integrity
│       ├── DocumentValidator.ts
│       ├── ChangelogManager.ts
│       └── ChecklistManager.ts
│
├── backend/                    # Backend Intelligence Layer
│   ├── tracker/
│   │   ├── CodeAnalyzer.ts
│   │   ├── RequirementsAccumulator.ts
│   │   └── ASTParser.ts
│   │
│   ├── spec/
│   │   ├── FirebaseSpecGenerator.ts
│   │   ├── SecurityRulesGenerator.ts
│   │   └── TypeDefinitionGenerator.ts
│   │
│   ├── handoff/
│   │   ├── GeminiHandoff.ts
│   │   └── PromptFormatter.ts
│   │
│   └── verification/
│       ├── ProvisioningVerifier.ts
│       ├── SecurityRulesTester.ts
│       ├── SpecComparator.ts
│       └── RollbackSystem.ts
│
├── firebase/                   # Firebase Studio Integration
│   ├── PreviewIntegration.ts
│   ├── EmulatorManager.ts
│   ├── HotReloadCoordinator.ts
│   └── ConsoleMonitor.ts
│
├── ui/                         # User Interface
│   ├── sidebar/
│   │   ├── WorkflowPanel.ts
│   │   ├── BackendTrackerPanel.ts
│   │   └── ChecklistPanel.ts
│   │
│   └── webview/
│       ├── TaskProgressView.ts
│       ├── VerificationReportView.ts
│       └── BackendSpecView.ts
│
├── storage/                    # Persistence
│   ├── SnapshotManager.ts
│   ├── StateStore.ts
│   └── ConfigManager.ts
│
└── extension.ts                # Extension Entry Point
```

### Data Flow

```
User Input (Task/Checklist)
         │
         ▼
┌─────────────────┐
│ Context Resolver │ ──→ Resolve @mentions to file content
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Planning Agent  │ ──→ Create execution plan
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auditing Agent  │ ──→ Review plan, suggest fixes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execution Agent │ ──→ Generate/modify code
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend Tracker │ ──→ (Silent) Analyze code for Firebase usage
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Documentation Agent │ ──→ Update changelog, checklist
└────────┬────────────┘
         │
         ▼
┌─────────────────────────┐
│ Verification Orchestrator│
│  ├─ VerificationPipeline │ ──→ TypeScript, ESLint, tests, build
│  ├─ HolisticChecker      │ ──→ Imports, types, consistency
│  └─ RuntimeErrorDetector │ ──→ Preview console monitoring
└────────┬────────────────┘
         │
         ▼
    ┌────┴────┐
    │ Pass?   │
    └────┬────┘
    Yes  │  No
     │   │   │
     │   │   ▼
     │   │ ┌─────────────────────┐
     │   │ │ Self-Correction Loop │ ──→ Diagnose, fix, retry (up to 3x)
     │   │ └──────────┬──────────┘
     │   │            │
     │   │            ▼
     │   │      [Back to Verification]
     │   │
     ▼   ▼
┌─────────────────┐
│ Task Complete   │
└─────────────────┘
```

---

## 5. The Self-Correction Loop

**This is the core innovation.** The Self-Correction Loop is what transforms optimistic AI coding into verified AI coding.

### Why Self-Correction Matters

Without self-correction:
```
AI writes code → Reports "Done" → User discovers bugs → User debugs → Frustration
```

With self-correction:
```
AI writes code → Verifies own work → Finds bugs → Fixes bugs → Verifies again → Reports "Actually Done"
```

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-CORRECTION LOOP                         │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Runtime   │    │  Holistic   │    │   Verification      │ │
│  │   Error     │───▶│ Consistency │───▶│   Pipeline          │ │
│  │  Detector   │    │   Checker   │    │   (CI/CD)           │ │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘ │
│         │                  │                      │            │
│         └──────────────────┴──────────────────────┘            │
│                            │                                    │
│                   ┌────────▼────────┐                          │
│                   │ Issue Aggregator │                          │
│                   └────────┬────────┘                          │
│                            │                                    │
│                   ┌────────▼────────┐                          │
│                   │   All Clear?    │                          │
│                   └────────┬────────┘                          │
│                    Yes     │      No                           │
│                     │      │       │                           │
│                     ▼      │       ▼                           │
│              ┌──────────┐  │  ┌──────────────┐                 │
│              │ Complete │  │  │ Fix Strategy │                 │
│              └──────────┘  │  │  Determiner  │                 │
│                            │  └──────┬───────┘                 │
│                            │         │                          │
│                            │         ▼                          │
│                            │  ┌──────────────┐                 │
│                            │  │  Correction  │                 │
│                            │  │   Executor   │                 │
│                            │  └──────┬───────┘                 │
│                            │         │                          │
│                            │         ▼                          │
│                            │  ┌──────────────┐                 │
│                            │  │ Retry Count  │                 │
│                            │  │    < 3?      │                 │
│                            │  └──────┬───────┘                 │
│                            │   Yes   │   No                    │
│                            │    │    │    │                    │
│                            │    │    │    ▼                    │
│                            │    │    │ ┌────────────┐          │
│                            │    │    │ │  Escalate  │          │
│                            │    │    │ │  to User   │          │
│                            │    │    │ └────────────┘          │
│                            │    │    │                          │
│                            │    ▼    │                          │
│                            │ [Loop back to verification]       │
│                            │                                    │
└────────────────────────────┴────────────────────────────────────┘
```

### Core Implementation

```typescript
// src/core/verification/SelfCorrectionLoop.ts

interface CorrectionAttempt {
    attemptNumber: number;
    issues: VerificationIssue[];
    fixStrategy: FixStrategy;
    changes: FileChange[];
    result: 'success' | 'partial' | 'failed';
    timestamp: Date;
}

interface SelfCorrectionContext {
    taskId: string;
    originalResult: TaskResult;
    attempts: CorrectionAttempt[];
    maxAttempts: number;
    currentState: 'verifying' | 'correcting' | 'complete' | 'escalated';
}

class SelfCorrectionLoop {
    private readonly maxAttempts = 3;
    private readonly runtimeDetector: RuntimeErrorDetector;
    private readonly holisticChecker: HolisticConsistencyChecker;
    private readonly verificationPipeline: VerificationPipeline;
    private readonly executionAgent: ExecutionAgent;
    
    constructor(deps: SelfCorrectionDependencies) {
        this.runtimeDetector = deps.runtimeDetector;
        this.holisticChecker = deps.holisticChecker;
        this.verificationPipeline = deps.verificationPipeline;
        this.executionAgent = deps.executionAgent;
    }
    
    /**
     * Main entry point: Verify and correct until success or escalation
     */
    async verifyAndCorrect(result: TaskResult): Promise<CorrectionResult> {
        const context: SelfCorrectionContext = {
            taskId: result.taskId,
            originalResult: result,
            attempts: [],
            maxAttempts: this.maxAttempts,
            currentState: 'verifying'
        };
        
        let currentResult = result;
        
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            console.log(`[Self-Correction] Verification attempt ${attempt}/${this.maxAttempts}`);
            
            // Run all verification checks
            const issues = await this.runAllVerification(currentResult);
            
            // If no issues, we're done!
            if (issues.length === 0) {
                context.currentState = 'complete';
                return {
                    success: true,
                    finalResult: currentResult,
                    attempts: context.attempts,
                    message: attempt === 1 
                        ? 'All checks passed on first attempt'
                        : `Fixed after ${attempt - 1} correction(s)`
                };
            }
            
            // Record this attempt
            const attemptRecord: CorrectionAttempt = {
                attemptNumber: attempt,
                issues,
                fixStrategy: this.determineFixStrategy(issues),
                changes: [],
                result: 'pending' as any,
                timestamp: new Date()
            };
            
            // If this is the last attempt, escalate
            if (attempt === this.maxAttempts) {
                context.currentState = 'escalated';
                attemptRecord.result = 'failed';
                context.attempts.push(attemptRecord);
                
                return {
                    success: false,
                    finalResult: currentResult,
                    attempts: context.attempts,
                    message: `Unable to resolve after ${this.maxAttempts} attempts`,
                    remainingIssues: issues,
                    escalationReason: this.formatEscalationReason(issues)
                };
            }
            
            // Attempt correction
            context.currentState = 'correcting';
            console.log(`[Self-Correction] Attempting fix for ${issues.length} issue(s)`);
            
            const correction = await this.attemptCorrection(currentResult, issues);
            
            attemptRecord.changes = correction.changes;
            attemptRecord.result = correction.success ? 'success' : 'partial';
            context.attempts.push(attemptRecord);
            
            if (correction.success) {
                currentResult = correction.updatedResult;
            } else {
                // Correction failed, but we'll try verification again
                // Maybe partial fixes were applied
                currentResult = correction.updatedResult;
            }
        }
        
        // Should never reach here due to loop logic, but TypeScript needs it
        return {
            success: false,
            finalResult: currentResult,
            attempts: context.attempts,
            message: 'Unexpected exit from correction loop'
        };
    }
    
    /**
     * Run all verification checks and aggregate issues
     */
    private async runAllVerification(result: TaskResult): Promise<VerificationIssue[]> {
        const allIssues: VerificationIssue[] = [];
        
        // 1. Runtime Error Detection (from preview console)
        console.log('  → Checking runtime errors...');
        const runtimeErrors = await this.runtimeDetector.detect();
        allIssues.push(...runtimeErrors.map(e => ({
            type: 'runtime' as const,
            severity: e.isFatal ? 'critical' as const : 'high' as const,
            message: e.message,
            location: e.location,
            suggestedFix: e.suggestedFix
        })));
        
        // 2. Holistic Consistency Checks
        console.log('  → Checking consistency...');
        const consistencyIssues = await this.holisticChecker.checkAll(result);
        allIssues.push(...consistencyIssues);
        
        // 3. Deterministic Verification Pipeline
        console.log('  → Running verification pipeline...');
        const pipelineReport = await this.verificationPipeline.runAll();
        
        if (!pipelineReport.typescript.passed) {
            allIssues.push({
                type: 'build',
                severity: 'critical',
                message: 'TypeScript compilation failed',
                details: pipelineReport.typescript.errors
            });
        }
        
        if (!pipelineReport.eslint.passed) {
            allIssues.push(...pipelineReport.eslint.errors.map(e => ({
                type: 'lint' as const,
                severity: e.severity === 'error' ? 'high' as const : 'medium' as const,
                message: e.message,
                location: e.file + ':' + e.line
            })));
        }
        
        if (!pipelineReport.tests.passed) {
            allIssues.push({
                type: 'test',
                severity: 'high',
                message: `${pipelineReport.tests.failed} test(s) failed`,
                details: pipelineReport.tests.failures
            });
        }
        
        if (!pipelineReport.build.passed) {
            allIssues.push({
                type: 'build',
                severity: 'critical',
                message: 'Build failed',
                details: pipelineReport.build.errors
            });
        }
        
        // Deduplicate and prioritize
        return this.deduplicateAndPrioritize(allIssues);
    }
    
    /**
     * Determine the best strategy for fixing issues
     */
    private determineFixStrategy(issues: VerificationIssue[]): FixStrategy {
        // Priority: critical build errors first, then runtime, then consistency
        const hasCriticalBuild = issues.some(i => i.type === 'build' && i.severity === 'critical');
        const hasRuntimeErrors = issues.some(i => i.type === 'runtime');
        const hasConsistencyIssues = issues.some(i => i.type === 'consistency');
        
        if (hasCriticalBuild) {
            return {
                approach: 'fix-build-first',
                targetIssues: issues.filter(i => i.type === 'build'),
                reasoning: 'Cannot verify runtime without successful build'
            };
        }
        
        if (hasRuntimeErrors) {
            return {
                approach: 'fix-runtime',
                targetIssues: issues.filter(i => i.type === 'runtime'),
                reasoning: 'Runtime errors prevent feature from working'
            };
        }
        
        if (hasConsistencyIssues) {
            return {
                approach: 'fix-consistency',
                targetIssues: issues.filter(i => i.type === 'consistency'),
                reasoning: 'Code-documentation consistency required'
            };
        }
        
        return {
            approach: 'fix-all',
            targetIssues: issues,
            reasoning: 'Mixed issues, attempting comprehensive fix'
        };
    }
    
    /**
     * Attempt to fix issues using the execution agent
     */
    private async attemptCorrection(
        result: TaskResult,
        issues: VerificationIssue[]
    ): Promise<CorrectionAttemptResult> {
        const strategy = this.determineFixStrategy(issues);
        
        // Build a correction prompt for the execution agent
        const correctionPrompt = this.buildCorrectionPrompt(result, strategy);
        
        try {
            // Execute the correction
            const correctionResult = await this.executionAgent.executeCorrection({
                originalTask: result.task,
                issues: strategy.targetIssues,
                prompt: correctionPrompt,
                constraints: {
                    preserveWorkingCode: true,
                    minimalChanges: true,
                    targetFiles: this.identifyTargetFiles(issues)
                }
            });
            
            return {
                success: true,
                changes: correctionResult.changes,
                updatedResult: {
                    ...result,
                    filesModified: [
                        ...result.filesModified,
                        ...correctionResult.changes.map(c => ({
                            path: c.path,
                            changeType: 'correction' as const
                        }))
                    ]
                }
            };
        } catch (error) {
            console.error('[Self-Correction] Correction attempt failed:', error);
            return {
                success: false,
                changes: [],
                updatedResult: result,
                error: error.message
            };
        }
    }
    
    /**
     * Build a targeted correction prompt
     */
    private buildCorrectionPrompt(result: TaskResult, strategy: FixStrategy): string {
        const issueDescriptions = strategy.targetIssues
            .map(i => `- [${i.severity.toUpperCase()}] ${i.message}${i.location ? ` at ${i.location}` : ''}`)
            .join('\n');
        
        return `
## Self-Correction Required

The previous implementation has the following issues that need to be fixed:

${issueDescriptions}

### Strategy: ${strategy.approach}
${strategy.reasoning}

### Constraints
- Make MINIMAL changes to fix the issues
- Do NOT refactor unrelated code
- Preserve all working functionality
- Focus only on the specific errors

### Files to examine
${this.identifyTargetFiles(strategy.targetIssues).join('\n')}

Fix these issues and report what was changed.
        `.trim();
    }
    
    private deduplicateAndPrioritize(issues: VerificationIssue[]): VerificationIssue[] {
        // Remove duplicates by message
        const seen = new Map<string, VerificationIssue>();
        for (const issue of issues) {
            const key = `${issue.type}:${issue.message}`;
            if (!seen.has(key) || 
                this.severityRank(issue.severity) > this.severityRank(seen.get(key)!.severity)) {
                seen.set(key, issue);
            }
        }
        
        // Sort by severity
        return Array.from(seen.values()).sort((a, b) => 
            this.severityRank(b.severity) - this.severityRank(a.severity)
        );
    }
    
    private severityRank(severity: string): number {
        const ranks = { critical: 4, high: 3, medium: 2, low: 1 };
        return ranks[severity] || 0;
    }
    
    private identifyTargetFiles(issues: VerificationIssue[]): string[] {
        const files = new Set<string>();
        for (const issue of issues) {
            if (issue.location) {
                const file = issue.location.split(':')[0];
                files.add(file);
            }
        }
        return Array.from(files);
    }
    
    private formatEscalationReason(issues: VerificationIssue[]): string {
        return `
Unable to automatically resolve the following issues after ${this.maxAttempts} attempts:

${issues.map(i => `• [${i.severity}] ${i.message}`).join('\n')}

Please review and provide guidance.
        `.trim();
    }
}
```

### Runtime Error Detection

The Runtime Error Detector monitors the Firebase Studio preview console for errors:

```typescript
// src/core/verification/RuntimeErrorDetector.ts

interface RuntimeError {
    type: 'exception' | 'rejection' | 'console-error' | 'network';
    message: string;
    stack?: string;
    location?: string;
    timestamp: Date;
    isFatal: boolean;
    suggestedFix?: string;
}

class RuntimeErrorDetector {
    private consoleMonitor: ConsoleMonitor;
    private errors: RuntimeError[] = [];
    private isMonitoring = false;
    
    constructor(private previewIntegration: PreviewIntegration) {
        this.consoleMonitor = new ConsoleMonitor();
    }
    
    /**
     * Start monitoring the preview for errors
     */
    async startMonitoring(): Promise<void> {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.errors = [];
        
        // Hook into preview console
        await this.consoleMonitor.attach(this.previewIntegration.getPreviewFrame());
        
        this.consoleMonitor.on('error', (error) => {
            this.errors.push(this.parseError(error));
        });
        
        this.consoleMonitor.on('unhandledrejection', (error) => {
            this.errors.push({
                type: 'rejection',
                message: error.reason?.message || String(error.reason),
                stack: error.reason?.stack,
                timestamp: new Date(),
                isFatal: true
            });
        });
    }
    
    /**
     * Get all detected errors since monitoring started
     */
    async detect(): Promise<RuntimeError[]> {
        // Wait briefly for any pending errors to be captured
        await this.wait(500);
        
        return this.errors.map(error => ({
            ...error,
            suggestedFix: this.suggestFix(error)
        }));
    }
    
    /**
     * Clear error log and reset
     */
    reset(): void {
        this.errors = [];
    }
    
    private parseError(rawError: any): RuntimeError {
        // Parse console.error or thrown exceptions
        const message = rawError.message || String(rawError);
        const stack = rawError.stack;
        
        // Extract file location from stack trace
        const location = this.extractLocation(stack);
        
        // Determine if fatal (uncaught exception vs console.error)
        const isFatal = rawError.type === 'exception' || 
                        message.includes('Uncaught') ||
                        message.includes('Cannot read property');
        
        return {
            type: rawError.type || 'console-error',
            message,
            stack,
            location,
            timestamp: new Date(),
            isFatal
        };
    }
    
    private extractLocation(stack?: string): string | undefined {
        if (!stack) return undefined;
        
        // Match typical stack trace patterns
        const match = stack.match(/at\s+.*?\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
            return `${match[1]}:${match[2]}`;
        }
        
        return undefined;
    }
    
    private suggestFix(error: RuntimeError): string {
        const msg = error.message.toLowerCase();
        
        // Common error patterns and fixes
        if (msg.includes('cannot read property') || msg.includes('undefined')) {
            return 'Add null/undefined check before accessing property';
        }
        
        if (msg.includes('is not a function')) {
            return 'Check import statement and function name spelling';
        }
        
        if (msg.includes('module not found') || msg.includes('cannot find module')) {
            return 'Install missing dependency or fix import path';
        }
        
        if (msg.includes('network error') || msg.includes('failed to fetch')) {
            return 'Check API endpoint URL and network connectivity';
        }
        
        if (msg.includes('firebase') && msg.includes('permission')) {
            return 'Update Firestore security rules or check authentication';
        }
        
        return 'Review error message and stack trace for context';
    }
    
    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### Holistic Consistency Checker

The Holistic Checker validates cross-cutting concerns that simple linting misses:

```typescript
// src/core/verification/HolisticChecker.ts

class HolisticConsistencyChecker {
    /**
     * Run all holistic checks
     */
    async checkAll(result: TaskResult): Promise<VerificationIssue[]> {
        const issues: VerificationIssue[] = [];
        
        // 1. Code-Documentation Consistency
        console.log('    ▶ Checking code-doc consistency...');
        const docIssues = await this.checkCodeDocConsistency(result);
        issues.push(...docIssues);
        
        // 2. Import-Export Matching
        console.log('    ▶ Checking imports...');
        const importIssues = await this.checkImports(result);
        issues.push(...importIssues);
        
        // 3. Type Consistency
        console.log('    ▶ Checking types...');
        const typeIssues = await this.checkTypes(result);
        issues.push(...typeIssues);
        
        // 4. Cross-File Dependencies
        console.log('    ▶ Checking dependencies...');
        const depIssues = await this.checkDependencies(result);
        issues.push(...depIssues);
        
        return issues;
    }
    
    /**
     * Check if code matches documentation
     */
    private async checkCodeDocConsistency(result: TaskResult): Promise<VerificationIssue[]> {
        const issues: VerificationIssue[] = [];
        
        // Read changelog
        const changelogPath = 'AGENTS.md/changelog.md';
        if (!fs.existsSync(changelogPath)) {
            return issues;
        }
        
        const changelog = fs.readFileSync(changelogPath, 'utf-8');
        
        // Extract function names mentioned in latest entry
        const documentedFunctions = this.extractFunctionNames(changelog);
        
        // Extract actual function names from created/modified files
        const actualFunctions = new Set<string>();
        
        for (const file of result.filesCreated.concat(result.filesModified)) {
            if (fs.existsSync(file.path)) {
                const code = fs.readFileSync(file.path, 'utf-8');
                const functions = this.extractFunctionsFromCode(code);
                functions.forEach(f => actualFunctions.add(f));
            }
        }
        
        // Check for documented but missing implementations
        for (const docFunc of documentedFunctions) {
            if (!actualFunctions.has(docFunc)) {
                issues.push({
                    type: 'consistency',
                    severity: 'high',
                    message: `Documented function "${docFunc}" not found in code`,
                    suggestedFix: `Implement ${docFunc}() or update documentation`
                });
            }
        }
        
        return issues;
    }
    
    /**
     * Check that all imports resolve to existing exports
     */
    private async checkImports(result: TaskResult): Promise<VerificationIssue[]> {
        const issues: VerificationIssue[] = [];
        
        for (const file of result.filesCreated.concat(result.filesModified)) {
            if (!fs.existsSync(file.path)) continue;
            
            const code = fs.readFileSync(file.path, 'utf-8');
            const imports = this.extractImports(code);
            
            for (const imp of imports) {
                // Check relative imports
                if (imp.source.startsWith('.')) {
                    const resolvedPath = this.resolveImportPath(file.path, imp.source);
                    
                    if (!fs.existsSync(resolvedPath)) {
                        issues.push({
                            type: 'consistency',
                            severity: 'critical',
                            message: `Import "${imp.source}" cannot be resolved`,
                            location: file.path,
                            suggestedFix: `Create ${resolvedPath} or fix import path`
                        });
                    } else {
                        // Check that exported names exist
                        const targetCode = fs.readFileSync(resolvedPath, 'utf-8');
                        const exports = this.extractExports(targetCode);
                        
                        for (const name of imp.names) {
                            if (name !== 'default' && !exports.has(name)) {
                                issues.push({
                                    type: 'consistency',
                                    severity: 'high',
                                    message: `"${name}" is not exported from "${imp.source}"`,
                                    location: file.path,
                                    suggestedFix: `Export ${name} from ${resolvedPath} or fix import`
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return issues;
    }
    
    /**
     * Check type consistency across files
     */
    private async checkTypes(result: TaskResult): Promise<VerificationIssue[]> {
        // TypeScript handles most of this, but we check for common issues
        // like using 'any' excessively or type mismatches at boundaries
        const issues: VerificationIssue[] = [];
        
        for (const file of result.filesCreated) {
            if (!file.path.endsWith('.ts') && !file.path.endsWith('.tsx')) continue;
            if (!fs.existsSync(file.path)) continue;
            
            const code = fs.readFileSync(file.path, 'utf-8');
            
            // Count 'any' usage
            const anyCount = (code.match(/:\s*any\b/g) || []).length;
            
            if (anyCount > 3) {
                issues.push({
                    type: 'consistency',
                    severity: 'medium',
                    message: `Excessive use of "any" type (${anyCount} occurrences)`,
                    location: file.path,
                    suggestedFix: 'Replace "any" with proper types for type safety'
                });
            }
        }
        
        return issues;
    }
    
    /**
     * Check cross-file dependencies are satisfied
     */
    private async checkDependencies(result: TaskResult): Promise<VerificationIssue[]> {
        const issues: VerificationIssue[] = [];
        
        // Check package.json dependencies
        const packageJsonPath = 'package.json';
        if (!fs.existsSync(packageJsonPath)) return issues;
        
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const installedDeps = new Set([
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {})
        ]);
        
        for (const file of result.filesCreated.concat(result.filesModified)) {
            if (!fs.existsSync(file.path)) continue;
            
            const code = fs.readFileSync(file.path, 'utf-8');
            const imports = this.extractImports(code);
            
            for (const imp of imports) {
                // Check npm package imports (not relative)
                if (!imp.source.startsWith('.') && !imp.source.startsWith('@/')) {
                    const packageName = imp.source.startsWith('@') 
                        ? imp.source.split('/').slice(0, 2).join('/')
                        : imp.source.split('/')[0];
                    
                    if (!installedDeps.has(packageName) && !this.isBuiltIn(packageName)) {
                        issues.push({
                            type: 'consistency',
                            severity: 'critical',
                            message: `Package "${packageName}" is not installed`,
                            location: file.path,
                            suggestedFix: `Run: npm install ${packageName}`
                        });
                    }
                }
            }
        }
        
        return issues;
    }
    
    // Helper methods
    private extractFunctionNames(changelog: string): string[] {
        const matches = changelog.match(/`(\w+)\(\)`/g) || [];
        return matches.map(m => m.replace(/[`()]/g, ''));
    }
    
    private extractFunctionsFromCode(code: string): string[] {
        const patterns = [
            /function\s+(\w+)/g,
            /const\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
            /(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/g
        ];
        
        const functions: string[] = [];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                functions.push(match[1]);
            }
        }
        return functions;
    }
    
    private extractImports(code: string): ImportInfo[] {
        const imports: ImportInfo[] = [];
        const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
        
        let match;
        while ((match = importRegex.exec(code)) !== null) {
            const names = match[1] 
                ? match[1].split(',').map(n => n.trim().split(' as ')[0].trim())
                : match[2] ? ['*'] : [match[3] || 'default'];
            
            imports.push({
                names,
                source: match[4]
            });
        }
        
        return imports;
    }
    
    private extractExports(code: string): Set<string> {
        const exports = new Set<string>();
        
        // export const/function/class
        const namedExports = code.match(/export\s+(?:const|let|var|function|class)\s+(\w+)/g) || [];
        namedExports.forEach(e => {
            const name = e.split(/\s+/).pop();
            if (name) exports.add(name);
        });
        
        // export { ... }
        const bracketExports = code.match(/export\s+{([^}]+)}/g) || [];
        bracketExports.forEach(e => {
            const names = e.replace(/export\s+{|}|/g, '').split(',');
            names.forEach(n => exports.add(n.trim().split(' as ')[0].trim()));
        });
        
        // export default
        if (code.includes('export default')) {
            exports.add('default');
        }
        
        return exports;
    }
    
    private resolveImportPath(fromFile: string, importSource: string): string {
        const dir = path.dirname(fromFile);
        let resolved = path.resolve(dir, importSource);
        
        // Try common extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
        for (const ext of extensions) {
            if (fs.existsSync(resolved + ext)) {
                return resolved + ext;
            }
        }
        
        return resolved;
    }
    
    private isBuiltIn(packageName: string): boolean {
        const builtIns = ['fs', 'path', 'http', 'https', 'crypto', 'util', 'events', 'stream'];
        return builtIns.includes(packageName);
    }
}

interface ImportInfo {
    names: string[];
    source: string;
}
```

### Self-Correction Rules

The Self-Correction Loop follows strict rules about what it will and won't do:

**Automatic Correction (No User Input):**
- Syntax errors detected by TypeScript
- Missing imports that can be resolved
- Runtime exceptions with clear fixes
- ESLint auto-fixable issues
- Missing null checks
- Type mismatches with obvious solutions

**User Escalation Required:**
- Architecture changes needed
- Security-related decisions
- Ambiguous requirements
- Repeated failures (3+ attempts)
- Changes affecting multiple features
- Performance trade-off decisions

---

## 6. Deterministic Verification Pipeline

The Verification Pipeline runs deterministic (non-AI) checks to validate code quality.

### Pipeline Overview

```typescript
// src/core/verification/VerificationPipeline.ts

interface VerificationReport {
    timestamp: Date;
    passed: boolean;
    typescript: CheckResult;
    eslint: CheckResult;
    tests: TestResult;
    build: CheckResult;
    ghostFiles: GhostFileResult;
    coverage: CoverageResult;
    documentation: DocumentationResult;
}

class VerificationPipeline {
    async runAll(): Promise<VerificationReport> {
        const timestamp = new Date();
        
        console.log('[Verification Pipeline] Starting...');
        
        // Run all checks in parallel where possible
        const [typescript, eslint, tests, build] = await Promise.all([
            this.runTypeScript(),
            this.runESLint(),
            this.runTests(),
            this.runBuild()
        ]);
        
        // Sequential checks that depend on build
        const ghostFiles = await this.detectGhostFiles();
        const coverage = await this.checkCoverage();
        const documentation = await this.validateDocumentation();
        
        const passed = typescript.passed && 
                       eslint.passed && 
                       tests.passed && 
                       build.passed &&
                       ghostFiles.passed &&
                       documentation.passed;
        
        console.log(`[Verification Pipeline] ${passed ? 'PASSED' : 'FAILED'}`);
        
        return {
            timestamp,
            passed,
            typescript,
            eslint,
            tests,
            build,
            ghostFiles,
            coverage,
            documentation
        };
    }
    
    /**
     * TypeScript compilation check
     */
    private async runTypeScript(): Promise<CheckResult> {
        console.log('  → TypeScript check...');
        
        try {
            const result = await exec('npx tsc --noEmit', { cwd: this.workspaceRoot });
            return { passed: true, errors: [] };
        } catch (error) {
            return {
                passed: false,
                errors: this.parseTypeScriptErrors(error.stderr || error.stdout)
            };
        }
    }
    
    /**
     * ESLint check
     */
    private async runESLint(): Promise<CheckResult> {
        console.log('  → ESLint check...');
        
        try {
            const result = await exec('npx eslint . --ext .ts,.tsx --format json', {
                cwd: this.workspaceRoot
            });
            return { passed: true, errors: [] };
        } catch (error) {
            const eslintOutput = JSON.parse(error.stdout || '[]');
            const errors = eslintOutput
                .flatMap(file => file.messages.map(msg => ({
                    file: file.filePath,
                    line: msg.line,
                    message: msg.message,
                    severity: msg.severity === 2 ? 'error' : 'warning'
                })));
            
            const hasErrors = errors.some(e => e.severity === 'error');
            return { passed: !hasErrors, errors };
        }
    }
    
    /**
     * Test execution
     */
    private async runTests(): Promise<TestResult> {
        console.log('  → Running tests...');
        
        try {
            const result = await exec('npm test -- --json', { cwd: this.workspaceRoot });
            const testOutput = JSON.parse(result.stdout);
            
            return {
                passed: testOutput.success,
                total: testOutput.numTotalTests,
                passed: testOutput.numPassedTests,
                failed: testOutput.numFailedTests,
                failures: testOutput.testResults
                    .flatMap(r => r.assertionResults)
                    .filter(a => a.status === 'failed')
                    .map(a => ({ name: a.title, error: a.failureMessages[0] }))
            };
        } catch (error) {
            return {
                passed: false,
                total: 0,
                passed: 0,
                failed: 1,
                failures: [{ name: 'Test execution', error: error.message }]
            };
        }
    }
    
    /**
     * Build verification
     */
    private async runBuild(): Promise<CheckResult> {
        console.log('  → Build check...');
        
        try {
            await exec('npm run build', { cwd: this.workspaceRoot });
            return { passed: true, errors: [] };
        } catch (error) {
            return {
                passed: false,
                errors: [{ message: error.stderr || error.message }]
            };
        }
    }
    
    /**
     * Ghost file detection - files that exist but shouldn't
     */
    private async detectGhostFiles(): Promise<GhostFileResult> {
        console.log('  → Ghost file detection...');
        
        try {
            const result = await exec('git ls-files --others --exclude-standard', {
                cwd: this.workspaceRoot
            });
            
            const unexpectedFiles = result.stdout
                .split('\n')
                .filter(f => f.trim())
                .filter(f => !this.isExpectedUntracked(f));
            
            return {
                passed: unexpectedFiles.length === 0,
                unexpectedFiles
            };
        } catch {
            // Git not available, skip this check
            return { passed: true, unexpectedFiles: [] };
        }
    }
    
    /**
     * Code coverage check
     */
    private async checkCoverage(): Promise<CoverageResult> {
        console.log('  → Coverage check...');
        
        const coveragePath = path.join(this.workspaceRoot, 'coverage/coverage-summary.json');
        
        if (!fs.existsSync(coveragePath)) {
            return { passed: true, percentage: null, threshold: 70 };
        }
        
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
        const percentage = coverage.total.lines.pct;
        const threshold = 70;
        
        return {
            passed: percentage >= threshold,
            percentage,
            threshold
        };
    }
    
    /**
     * Documentation integrity validation
     */
    private async validateDocumentation(): Promise<DocumentationResult> {
        console.log('  → Documentation validation...');
        
        const validator = new DocumentValidator();
        
        const changelogResult = await validator.validateChangelog();
        const checklistResult = await validator.validateChecklist();
        
        return {
            passed: changelogResult.valid && checklistResult.valid,
            changelog: changelogResult,
            checklist: checklistResult
        };
    }
    
    private parseTypeScriptErrors(output: string): any[] {
        const errors = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            const match = line.match(/(.+)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)/);
            if (match) {
                errors.push({
                    file: match[1],
                    line: parseInt(match[2]),
                    column: parseInt(match[3]),
                    code: match[4],
                    message: match[5]
                });
            }
        }
        
        return errors;
    }
    
    private isExpectedUntracked(file: string): boolean {
        const expectedPatterns = [
            /node_modules/,
            /\.env/,
            /dist\//,
            /build\//,
            /coverage\//
        ];
        return expectedPatterns.some(p => p.test(file));
    }
}
```

### Documentation Integrity Validation

Three-layer validation ensures documentation is never corrupted:

```typescript
// src/core/documents/DocumentValidator.ts

class DocumentValidator {
    /**
     * Validate changelog integrity
     */
    async validateChangelog(): Promise<ValidationResult> {
        const changelogPath = 'AGENTS.md/changelog.md';
        
        if (!fs.existsSync(changelogPath)) {
            return { valid: false, reason: 'Changelog file not found' };
        }
        
        const content = fs.readFileSync(changelogPath, 'utf-8');
        
        // Layer 1: Structure validation
        const requiredHeaders = ['# Changelog'];
        for (const header of requiredHeaders) {
            if (!content.includes(header)) {
                return { valid: false, reason: `Missing required header: ${header}` };
            }
        }
        
        // Layer 2: Entry format validation
        const entryPattern = /## \[\d{4}-\d{2}-\d{2}\]/;
        if (!entryPattern.test(content)) {
            return { valid: false, reason: 'No valid date entries found' };
        }
        
        // Layer 3: Order validation (newest first)
        const dates = content.match(/## \[(\d{4}-\d{2}-\d{2})\]/g) || [];
        for (let i = 1; i < dates.length; i++) {
            const current = dates[i].match(/\d{4}-\d{2}-\d{2}/)[0];
            const previous = dates[i-1].match(/\d{4}-\d{2}-\d{2}/)[0];
            if (current > previous) {
                return { valid: false, reason: 'Changelog entries not in descending date order' };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Validate changelog update (before vs after)
     */
    validateChangelogUpdate(before: string, after: string): ValidationResult {
        const beforeLines = before.split('\n').length;
        const afterLines = after.split('\n').length;
        
        // Changelog must grow (append-only)
        if (afterLines <= beforeLines) {
            return {
                valid: false,
                reason: `Changelog shrank from ${beforeLines} to ${afterLines} lines`
            };
        }
        
        // All previous entries must still exist
        const beforeEntries = before.match(/## \[\d{4}-\d{2}-\d{2}\][^\n]*/g) || [];
        const afterContent = after;
        
        for (const entry of beforeEntries) {
            if (!afterContent.includes(entry)) {
                return {
                    valid: false,
                    reason: `Previous entry was removed: ${entry.substring(0, 50)}...`
                };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Validate checklist integrity
     */
    async validateChecklist(): Promise<ValidationResult> {
        const checklistPath = 'AGENTS.md/checklist.md';
        
        if (!fs.existsSync(checklistPath)) {
            // Try to find any checklist file
            const files = fs.readdirSync('AGENTS.md');
            const checklist = files.find(f => f.includes('checklist'));
            if (!checklist) {
                return { valid: false, reason: 'No checklist file found' };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Validate checklist update (before vs after)
     */
    validateChecklistUpdate(before: string, after: string): ValidationResult {
        const beforeLines = before.split('\n').length;
        const afterLines = after.split('\n').length;
        
        // Checklist can stay same size or grow (mark items, add items)
        if (afterLines < beforeLines) {
            return {
                valid: false,
                reason: `Checklist shrank from ${beforeLines} to ${afterLines} lines`
            };
        }
        
        // Count checkbox transitions
        const beforeUnchecked = (before.match(/- \[ \]/g) || []).length;
        const afterUnchecked = (after.match(/- \[ \]/g) || []).length;
        const beforeChecked = (before.match(/- \[x\]/gi) || []).length;
        const afterChecked = (after.match(/- \[x\]/gi) || []).length;
        
        // Total checkboxes should stay same or increase
        const beforeTotal = beforeUnchecked + beforeChecked;
        const afterTotal = afterUnchecked + afterChecked;
        
        if (afterTotal < beforeTotal) {
            return {
                valid: false,
                reason: `Checkbox items were deleted (${beforeTotal} → ${afterTotal})`
            };
        }
        
        // Checked items should only increase (can't uncheck)
        if (afterChecked < beforeChecked) {
            return {
                valid: false,
                reason: `Completed items were unchecked (${beforeChecked} → ${afterChecked})`
            };
        }
        
        return { valid: true };
    }
}
```

---

# Part 3: The Workflow Engine

## 7. Five-Stage Sequential Workflow

The workflow enforces a strict sequence: **Plan → Audit → Execute → Document → Verify**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW STAGES                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐│
│   │ STAGE 1 │───▶│ STAGE 2 │───▶│ STAGE 3 │───▶│ STAGE 4 │───▶│ STAGE 5 ││
│   │Planning │    │Auditing │    │Execution│    │Document │    │ Verify  ││
│   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘│
│        │              │              │              │              │     │
│        ▼              ▼              ▼              ▼              ▼     │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐│
│   │ Gate 1  │    │ Gate 2  │    │ Gate 3  │    │ Gate 4  │    │ Gate 5  ││
│   │Plan OK? │    │Audit OK?│    │Code OK? │    │Docs OK? │    │CI/CD OK?││
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘│
│                                                                          │
│   ───────────────────────────────────────────────────────────────────    │
│                                                                          │
│   If Gate 5 fails:                                                       │
│                     ┌──────────────────┐                                 │
│                     │ Self-Correction  │ (up to 3 attempts)              │
│                     │      Loop        │                                 │
│                     └────────┬─────────┘                                 │
│                              │                                           │
│                              ▼                                           │
│                     [Back to Stage 3 or escalate]                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Stage Details

| Stage | Agent | Input | Output | Gate Criteria |
|-------|-------|-------|--------|---------------|
| 1. Planning | PlanningAgent | Task + Context | Execution Plan | Valid plan structure |
| 2. Auditing | AuditingAgent | Plan | Audit Report | Approval or auto-fixable issues |
| 3. Execution | ExecutionAgent | Approved Plan | Code Changes | Syntactically valid code |
| 4. Documentation | DocumentationAgent | Changes | Updated Docs | Integrity preserved |
| 5. Verification | Pipeline | Everything | Pass/Fail | All checks pass |

### Stage 1: Planning

```typescript
// src/core/agents/PlanningAgent.ts

interface ExecutionPlan {
    taskId: string;
    objective: string;
    steps: PlanStep[];
    estimatedChanges: FileChange[];
    risks: Risk[];
    rollbackStrategy: string;
}

class PlanningAgent {
    constructor(
        private llm: LLMClient,
        private contextResolver: ContextResolver
    ) {}
    
    async createPlan(task: Task, contexts: ContextItem[]): Promise<ExecutionPlan> {
        const prompt = this.buildPlanningPrompt(task, contexts);
        
        const response = await this.llm.complete({
            systemPrompt: PLANNING_SYSTEM_PROMPT,
            userPrompt: prompt,
            responseFormat: 'json'
        });
        
        const plan = this.parsePlanResponse(response);
        
        // Validate plan structure
        this.validatePlanStructure(plan);
        
        return plan;
    }
    
    private buildPlanningPrompt(task: Task, contexts: ContextItem[]): string {
        return `
## Task
${task.description}

## Context
${contexts.map(c => `### ${c.mention}\n${c.content}`).join('\n\n')}

## Instructions
Create an execution plan with:
1. Clear objective statement
2. Step-by-step implementation plan
3. Files to create/modify
4. Potential risks
5. Rollback strategy

Respond in JSON format matching the ExecutionPlan interface.
        `.trim();
    }
    
    private validatePlanStructure(plan: ExecutionPlan): void {
        if (!plan.objective) throw new Error('Plan missing objective');
        if (!plan.steps || plan.steps.length === 0) throw new Error('Plan has no steps');
        if (!plan.rollbackStrategy) throw new Error('Plan missing rollback strategy');
    }
}
```

### Stage 2: Auditing

```typescript
// src/core/agents/AuditingAgent.ts

interface AuditReport {
    planId: string;
    approval: 'approved' | 'conditional' | 'rejected';
    issues: AuditIssue[];
    autoFixable: boolean;
    suggestions: string[];
    securityConcerns: string[];
}

class AuditingAgent {
    constructor(private llm: LLMClient) {}
    
    async review(plan: ExecutionPlan): Promise<AuditReport> {
        const prompt = this.buildAuditPrompt(plan);
        
        const response = await this.llm.complete({
            systemPrompt: AUDITING_SYSTEM_PROMPT,
            userPrompt: prompt,
            responseFormat: 'json'
        });
        
        return this.parseAuditResponse(response);
    }
    
    private buildAuditPrompt(plan: ExecutionPlan): string {
        return `
## Plan to Review
${JSON.stringify(plan, null, 2)}

## Audit Checklist
1. Does the plan address the stated objective?
2. Are all necessary files identified?
3. Are there any security concerns?
4. Is error handling considered?
5. Is the rollback strategy sufficient?
6. Are there any architectural violations?

## Response Format
Provide approval status, list any issues, and indicate if issues are auto-fixable.
        `.trim();
    }
}
```

### Stage 3: Execution

```typescript
// src/core/agents/ExecutionAgent.ts

interface TaskResult {
    taskId: string;
    task: Task;
    success: boolean;
    filesCreated: FileInfo[];
    filesModified: FileInfo[];
    filesDeleted: string[];
    console: string[];
    errors: string[];
}

class ExecutionAgent {
    constructor(
        private llm: LLMClient,
        private fileSystem: FileSystemService
    ) {}
    
    async execute(plan: ExecutionPlan): Promise<TaskResult> {
        const result: TaskResult = {
            taskId: plan.taskId,
            task: plan.task,
            success: false,
            filesCreated: [],
            filesModified: [],
            filesDeleted: [],
            console: [],
            errors: []
        };
        
        try {
            for (const step of plan.steps) {
                await this.executeStep(step, result);
            }
            result.success = true;
        } catch (error) {
            result.errors.push(error.message);
        }
        
        return result;
    }
    
    private async executeStep(step: PlanStep, result: TaskResult): Promise<void> {
        switch (step.type) {
            case 'create-file':
                await this.createFile(step, result);
                break;
            case 'modify-file':
                await this.modifyFile(step, result);
                break;
            case 'delete-file':
                await this.deleteFile(step, result);
                break;
            case 'run-command':
                await this.runCommand(step, result);
                break;
        }
    }
}
```

### Stage 4: Documentation

```typescript
// src/core/agents/DocumentationAgent.ts

class DocumentationAgent {
    constructor(
        private changelogManager: ChangelogManager,
        private checklistManager: ChecklistManager,
        private validator: DocumentValidator
    ) {}
    
    async updateDocumentation(result: TaskResult): Promise<DocumentationResult> {
        // Capture before state
        const beforeChangelog = await this.changelogManager.read();
        const beforeChecklist = await this.checklistManager.read();
        
        // Update changelog
        const changelogEntry = this.formatChangelogEntry(result);
        await this.changelogManager.addEntry(changelogEntry);
        
        // Update checklist
        if (result.task.checklistItem) {
            await this.checklistManager.markComplete(result.task.checklistItem);
        }
        
        // Capture after state
        const afterChangelog = await this.changelogManager.read();
        const afterChecklist = await this.checklistManager.read();
        
        // Validate changes
        const changelogValid = this.validator.validateChangelogUpdate(beforeChangelog, afterChangelog);
        const checklistValid = this.validator.validateChecklistUpdate(beforeChecklist, afterChecklist);
        
        if (!changelogValid.valid || !checklistValid.valid) {
            // Rollback on validation failure
            await this.changelogManager.write(beforeChangelog);
            await this.checklistManager.write(beforeChecklist);
            
            throw new Error(`Documentation validation failed: ${changelogValid.reason || checklistValid.reason}`);
        }
        
        return {
            success: true,
            changelogUpdated: true,
            checklistUpdated: !!result.task.checklistItem
        };
    }
    
    private formatChangelogEntry(result: TaskResult): string {
        const date = new Date().toISOString().split('T')[0];
        
        return `
## [${date}] - ${result.task.name}

### ✅ Completed
- ${result.task.description}

### 📁 Files Created
${result.filesCreated.map(f => `- ${f.path}`).join('\n') || '- None'}

### 📝 Files Modified
${result.filesModified.map(f => `- ${f.path}`).join('\n') || '- None'}

---
        `.trim();
    }
}