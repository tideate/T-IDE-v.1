# Checklist 2: Workflow Engine & FSM

**Project:** Tideate IDE  
**Phase:** Core Infrastructure  
**Dependencies:** Checklist 1 (Core Verification Layer)  
**Enables:** Multi-Agent System, Autonomous Execution, Full Task Processing

---

## PROGRESS TRACKING

**Overall Completion:** 64% (18/28 items)

**Section 1 (Workflow FSM):** 6/6 items
**Section 2 (Gate Enforcer):** 7/7 items
**Section 3 (Context Resolution):** 5/5 items
**Section 4 (Snapshot Manager):** 0/5 items  
**Section 5 (Workflow Orchestrator):** 0/5 items  

**Current Focus:** Section 1 - Workflow FSM

---

## Section 1: Workflow Finite State Machine

The FSM ensures stages execute in order and gates cannot be bypassed.

### 1.1 State & Event Definitions
- [x] Create `src/core/workflow/WorkflowFSM.ts`
- [x] Define `WorkflowState` enum:
  - IDLE, PLANNING, AWAITING_PLAN_GATE, AUDITING, AWAITING_AUDIT_GATE
  - EXECUTING, AWAITING_EXECUTION_GATE, DOCUMENTING, AWAITING_DOCUMENTATION_GATE
  - VERIFYING, SELF_CORRECTING, COMPLETE, FAILED
- [x] Define `WorkflowEvent` enum:
  - START_TASK, PLANNING_COMPLETE, PLAN_GATE_PASSED, PLAN_GATE_FAILED
  - AUDITING_COMPLETE, AUDIT_GATE_PASSED, AUDIT_GATE_FAILED
  - EXECUTION_COMPLETE, EXECUTION_GATE_PASSED, EXECUTION_GATE_FAILED
  - DOCUMENTATION_COMPLETE, DOCUMENTATION_GATE_PASSED, DOCUMENTATION_GATE_FAILED
  - VERIFICATION_PASSED, VERIFICATION_FAILED
  - CORRECTION_SUCCEEDED, CORRECTION_EXHAUSTED, RESET
- [x] Define `StateTransition` interface: from, to, event, timestamp
- **Acceptance Criteria:**
  - All states from TDD Section 8 are represented
  - All events for state transitions are defined

### 1.2 Transition Map
- [x] Implement transition map as `Map<WorkflowState, Map<WorkflowEvent, WorkflowState>>`
- [x] Define valid transitions for IDLE state (only START_TASK → PLANNING)
- [x] Define valid transitions for PLANNING state (only PLANNING_COMPLETE → AWAITING_PLAN_GATE)
- [x] Define valid transitions for all AWAITING_*_GATE states (PASSED → next stage, FAILED → appropriate state)
- [x] Define AUDIT_GATE_FAILED → PLANNING (re-planning path)
- [x] Define VERIFYING transitions (PASSED → COMPLETE, FAILED → SELF_CORRECTING)
- [x] Define SELF_CORRECTING transitions (SUCCEEDED → VERIFYING, EXHAUSTED → FAILED)
- [x] Define terminal states COMPLETE and FAILED (only RESET → IDLE)
- **Acceptance Criteria:**
  - All valid transitions from TDD are encoded
  - No invalid transitions are possible

### 1.3 FSM Core Implementation
- [x] Implement `WorkflowFSM` class with private state and history properties
- [x] Initialize state to IDLE
- [x] Implement `transition(event: WorkflowEvent): boolean` method
- [x] Validate transition is allowed before executing
- [x] Record transition in history with timestamp
- [x] Log state transitions for debugging
- [x] Return true if transition succeeded, false if invalid
- **Acceptance Criteria:**
  - FSM starts in IDLE state
  - Valid transitions succeed and update state
  - Invalid transitions return false and don't change state
  - All transitions are recorded in history

### 1.4 FSM Query Methods
- [x] Implement `getState(): WorkflowState` method
- [x] Implement `getHistory(): StateTransition[]` method (return copy)
- [x] Implement `canTransition(event: WorkflowEvent): boolean` method
- [x] Implement `isTerminal(): boolean` method (checks if COMPLETE or FAILED)
- [x] Implement `isAwaitingGate(): boolean` method (checks if in any AWAITING_* state)
- **Acceptance Criteria:**
  - Query methods return correct information
  - History is returned as copy (not mutable reference)

### 1.5 FSM Reset & Recovery
- [x] Implement `reset()` method that transitions to IDLE if allowed
- [x] Implement `forceReset()` method for emergency recovery (bypasses transition rules)
- [x] Clear history on reset (or optionally archive it)
- [x] Log warning when forceReset is used
- **Acceptance Criteria:**
  - Normal reset only works from terminal states
  - Force reset works from any state (with warning)

### 1.6 FSM Serialization
- [x] Implement `serialize(): string` method (JSON representation)
- [x] Implement `static deserialize(json: string): WorkflowFSM` method
- [x] Include current state and history in serialization
- [x] Validate deserialized state is valid
- **Acceptance Criteria:**
  - FSM can be saved and restored
  - Invalid serialized data throws descriptive error

---

## Section 2: Gate Enforcer

Software-enforced checkpoints between workflow stages.

### 2.1 Gate Enforcer Base
- [x] Create `src/core/workflow/GateEnforcer.ts`
- [x] Define `GateResult` interface: passed, issues array, autoFixed (optional), report (optional)
- [x] Implement `GateEnforcer` class with dependencies:
  - DocumentValidator (from Checklist 1)
  - VerificationPipeline (from Checklist 1)
- **Acceptance Criteria:**
  - Class instantiates with required dependencies

### 2.2 Gate 1: Plan Validation
- [x] Implement `enforceGate1(plan: ExecutionPlan): Promise<GateResult>`
- [x] Validate plan has non-empty objective (minimum 10 characters)
- [x] Validate plan has at least one step
- [x] Validate each step has type and description
- [x] Validate plan has rollback strategy
- [x] Collect all issues and return GateResult
- **Acceptance Criteria:**
  - Rejects plans missing objective
  - Rejects plans with no steps
  - Rejects plans without rollback strategy
  - Accepts valid plans

### 2.3 Gate 2: Audit Validation
- [x] Implement `enforceGate2(audit: AuditReport): Promise<GateResult>`
- [x] If audit.approval === 'approved' → pass
- [x] If audit.approval === 'conditional' AND audit.autoFixable → pass with autoFixed flag
- [x] If audit.approval === 'rejected' OR (conditional AND not autoFixable) → fail
- [x] Include audit issues in GateResult
- **Acceptance Criteria:**
  - Approved audits pass
  - Conditional audits with auto-fix pass
  - Rejected audits fail
  - Non-auto-fixable conditional audits fail

### 2.4 Gate 3: Execution Validation
- [x] Implement `enforceGate3(result: TaskResult): Promise<GateResult>`
- [x] Check for execution errors in result.errors array
- [x] Verify all expected files in filesCreated actually exist on disk
- [x] Run basic syntax check on created .ts/.tsx files
- [x] Implement `checkSyntax(filePath)` helper using TypeScript transpileModule
- [x] Collect all issues and return GateResult
- **Acceptance Criteria:**
  - Fails if result has errors
  - Fails if expected files don't exist
  - Fails if created files have syntax errors
  - Passes for clean execution

### 2.5 Gate 4: Documentation Validation
- [x] Implement `enforceGate4(docs: DocumentationResult): Promise<GateResult>`
- [x] Check docs.success flag
- [x] Call DocumentValidator.validateChangelog()
- [x] Call DocumentValidator.validateChecklist()
- [x] Aggregate validation results into GateResult
- **Acceptance Criteria:**
  - Fails if documentation update failed
  - Fails if changelog validation fails
  - Fails if checklist validation fails
  - Passes when all documentation is valid

### 2.6 Gate 5: Verification Pipeline
- [x] Implement `enforceGate5(): Promise<GateResult>`
- [x] Call VerificationPipeline.runAll()
- [x] Check typescript.passed, eslint.passed, tests.passed, build.passed, documentation.passed
- [x] Collect specific failure reasons for each check
- [x] Include full VerificationReport in GateResult.report
- **Acceptance Criteria:**
  - Fails if any verification check fails
  - Provides specific failure reasons
  - Includes full report for debugging

### 2.7 Gate Enforcement Utilities
- [x] Implement `enforceGate(gateNumber: number, input: any): Promise<GateResult>` dispatcher
- [x] Add timing/logging around gate enforcement
- [x] Track gate pass/fail statistics
- [x] Implement `getGateStatistics(): GateStats` method
- **Acceptance Criteria:**
  - Can call gates by number
  - Gate execution is logged
  - Statistics are tracked

---

## Section 3: Context Resolution System

Enables @mentions to reference project documents.

### 3.1 Context Configuration
- [x] Define context config file location: `.tideate/context.json`
- [x] Define config schema:
  ```json
  {
    "version": "1.0.0",
    "mappings": {
      "@MentionName": "relative/path/to/file.md"
    }
  }
  ```
- [x] Create `src/core/context/ContextResolver.ts`
- [x] Define `ContextItem` interface: mention, path, content, type ('file' | 'section' | 'variable')
- **Acceptance Criteria:**
  - Config schema is well-defined
  - Interface captures all needed context information

### 3.2 Context Map Building
- [x] Implement `ContextResolver` class with workspaceRoot parameter
- [x] Implement `buildContextMap()` private method
- [x] Read and parse `.tideate/context.json`
- [x] Build `Map<string, string>` from mention to file path
- [x] Handle missing config file gracefully (return empty map)
- [x] Handle malformed config file with descriptive error
- **Acceptance Criteria:**
  - Successfully loads valid config
  - Returns empty map if config doesn't exist
  - Throws descriptive error for malformed config

### 3.3 Single Context Resolution
- [x] Implement `resolve(mention: string): ContextItem` method
- [x] Look up mention in context map
- [x] Throw `ContextResolutionError` if mention not found
- [x] Resolve relative paths (handle `..` in paths)
- [x] Read file content (DETERMINISTIC - no AI processing)
- [x] Return `ContextItem` with all fields populated
- [x] Create `ContextResolutionError` custom error class
- **Acceptance Criteria:**
  - Resolves valid mentions to file content
  - Throws descriptive error for unknown mentions
  - Handles relative paths correctly
  - Content is raw file content (no transformation)

### 3.4 Batch Resolution & Mention Extraction
- [x] Implement `resolveAll(mentions: string[]): ContextItem[]` method
- [x] Implement `extractMentions(text: string): string[]` method
- [x] Use regex pattern `/@\w+/g` to find mentions
- [x] Deduplicate extracted mentions
- [x] Implement `getAvailableMentions(): string[]` method
- **Acceptance Criteria:**
  - Batch resolution processes all mentions
  - Mention extraction finds all @mentions in text
  - Available mentions returns all configured mappings

### 3.5 Context Formatting
- [x] Implement `formatForPrompt(contexts: ContextItem[]): string` method
- [x] Format each context with header showing mention and source path
- [x] Separate contexts with dividers
- [x] Return formatted string ready for AI prompt injection
- **Acceptance Criteria:**
  - Formatted output is clear and readable
  - Source attribution is included
  - Multiple contexts are clearly separated

---

## Section 4: Snapshot Manager

Enables rollback to previous states on failure.

### 4.1 Snapshot Manager Base
- [ ] Create `src/storage/SnapshotManager.ts`
- [ ] Define `Snapshot` interface: id, name, timestamp, files (array of path + content)
- [ ] Define snapshot storage location: `.tideate/snapshots/`
- [ ] Implement `SnapshotManager` class with workspaceRoot parameter
- [ ] Ensure snapshot directory exists on instantiation
- **Acceptance Criteria:**
  - Class instantiates correctly
  - Snapshot directory is created if missing

### 4.2 Snapshot Creation
- [ ] Implement `create(name: string): Promise<string>` method (returns snapshot ID)
- [ ] Generate unique snapshot ID (UUID or timestamp-based)
- [ ] Identify files to snapshot (src/, AGENTS.md/, config files)
- [ ] Read all identified files and store content
- [ ] Save snapshot to `.tideate/snapshots/{id}.json`
- [ ] Return snapshot ID for later reference
- **Acceptance Criteria:**
  - Creates valid snapshot file
  - Captures all relevant project files
  - Returns usable snapshot ID

### 4.3 Snapshot Restoration
- [ ] Implement `restore(snapshotId: string): Promise<void>` method
- [ ] Load snapshot file by ID
- [ ] Throw error if snapshot not found
- [ ] Restore all files to their snapshotted content
- [ ] Handle files that exist in snapshot but not currently (create them)
- [ ] Handle files that exist currently but not in snapshot (optionally delete or warn)
- [ ] Log restoration progress
- **Acceptance Criteria:**
  - Successfully restores files to previous state
  - Creates missing files from snapshot
  - Handles missing snapshots gracefully

### 4.4 Snapshot Management
- [ ] Implement `list(): Promise<Snapshot[]>` method (metadata only, not full content)
- [ ] Implement `delete(snapshotId: string): Promise<void>` method
- [ ] Implement `getLatest(): Promise<Snapshot | null>` method
- [ ] Implement automatic cleanup: keep only last N snapshots (configurable, default 10)
- **Acceptance Criteria:**
  - Can list all snapshots with metadata
  - Can delete specific snapshots
  - Can retrieve most recent snapshot
  - Old snapshots are automatically cleaned up

### 4.5 Snapshot Diffing
- [ ] Implement `diff(snapshotId: string): Promise<FileDiff[]>` method
- [ ] Define `FileDiff` interface: path, status ('added' | 'modified' | 'deleted'), changes (optional)
- [ ] Compare current file state to snapshot state
- [ ] Identify added, modified, and deleted files
- [ ] Return array of differences
- **Acceptance Criteria:**
  - Correctly identifies added files
  - Correctly identifies modified files
  - Correctly identifies deleted files

---

## Section 5: Workflow Orchestrator

Coordinates the entire workflow through all stages.

### 5.1 Orchestrator Base
- [ ] Create `src/core/workflow/WorkflowOrchestrator.ts`
- [ ] Define `WorkflowResult` interface: success, task, result (TaskResult), attempts, error, rollbackPerformed
- [ ] Define `OrchestratorDependencies` interface listing all required components
- [ ] Implement `WorkflowOrchestrator` class with constructor accepting dependencies:
  - WorkflowFSM
  - GateEnforcer
  - ContextResolver
  - SnapshotManager
  - Agent placeholders (PlanningAgent, AuditingAgent, ExecutionAgent, DocumentationAgent)
  - SelfCorrectionLoop
- **Acceptance Criteria:**
  - Class instantiates with all dependencies
  - Dependencies are accessible for use in workflow

### 5.2 Task Context Resolution
- [ ] Implement `resolveTaskContexts(task: Task): ContextItem[]` private method
- [ ] Extract @mentions from task description
- [ ] Resolve all mentions to context items
- [ ] Handle resolution errors gracefully (log and continue with available contexts)
- **Acceptance Criteria:**
  - Extracts mentions from task
  - Resolves available contexts
  - Doesn't fail on unresolvable mentions

### 5.3 Main Execution Flow
- [ ] Implement `executeTask(task: Task): Promise<WorkflowResult>` main method
- [ ] Create pre-task snapshot
- [ ] Stage 1: Transition to PLANNING, call PlanningAgent (stub), transition to AWAITING_PLAN_GATE
- [ ] Gate 1: Call GateEnforcer.enforceGate1(), transition based on result
- [ ] Stage 2: Transition to AUDITING, call AuditingAgent (stub), transition to AWAITING_AUDIT_GATE
- [ ] Gate 2: Call GateEnforcer.enforceGate2(), transition based on result
- [ ] Stage 3: Transition to EXECUTING, call ExecutionAgent (stub), transition to AWAITING_EXECUTION_GATE
- [ ] Gate 3: Call GateEnforcer.enforceGate3(), transition based on result
- [ ] Stage 4: Transition to DOCUMENTING, call DocumentationAgent (stub), transition to AWAITING_DOCUMENTATION_GATE
- [ ] Gate 4: Call GateEnforcer.enforceGate4(), transition based on result
- [ ] Stage 5: Transition to VERIFYING, call SelfCorrectionLoop.verifyAndCorrect()
- [ ] Handle correction result (COMPLETE or FAILED)
- **Acceptance Criteria:**
  - Workflow progresses through all stages
  - Gates are enforced at each checkpoint
  - FSM state is always consistent with current stage

### 5.4 Error Handling & Rollback
- [ ] Wrap entire executeTask in try-catch
- [ ] On any error, restore pre-task snapshot
- [ ] Return WorkflowResult with success=false and rollbackPerformed=true
- [ ] Log detailed error information for debugging
- [ ] Ensure FSM is reset or left in FAILED state appropriately
- **Acceptance Criteria:**
  - Errors trigger snapshot restoration
  - WorkflowResult indicates rollback occurred
  - System is left in recoverable state

### 5.5 Workflow Hooks & Events
- [ ] Define workflow event callbacks: onStageStart, onStageComplete, onGatePass, onGateFail, onError
- [ ] Implement `setHooks(hooks: WorkflowHooks)` method
- [ ] Call appropriate hooks during workflow execution
- [ ] Hooks are optional (don't fail if not set)
- **Acceptance Criteria:**
  - Hooks are called at appropriate times
  - Missing hooks don't cause errors
  - Hooks receive relevant context data

---

## Exit Criteria

Before proceeding to Checklist 3, verify:

- [ ] **WorkflowFSM** correctly enforces all state transitions from TDD
- [ ] **WorkflowFSM** rejects invalid transitions (test by attempting skip)
- [ ] **GateEnforcer** validates plans, audits, execution results, and documentation
- [ ] **GateEnforcer** integrates with VerificationPipeline from Checklist 1
- [ ] **ContextResolver** loads config and resolves @mentions to file content
- [ ] **SnapshotManager** can create, restore, list, and diff snapshots
- [ ] **WorkflowOrchestrator** executes a task through all 5 stages (with stub agents)
- [ ] **WorkflowOrchestrator** performs rollback on failure
- [ ] FSM state is always consistent with workflow progress
- [ ] All gate failures result in appropriate FSM transitions
- [ ] No TypeScript errors in workflow engine code

---

## Notes for Builder

**Key Files to Create:**
```
src/core/workflow/
├── WorkflowFSM.ts
├── GateEnforcer.ts
└── WorkflowOrchestrator.ts

src/core/context/
└── ContextResolver.ts

src/storage/
└── SnapshotManager.ts
```

**Integration Points with Checklist 1:**
- GateEnforcer uses DocumentValidator for Gate 4
- GateEnforcer uses VerificationPipeline for Gate 5
- WorkflowOrchestrator uses SelfCorrectionLoop for Stage 5

**Stub Requirements:**
The orchestrator needs stub implementations for agents (PlanningAgent, AuditingAgent, ExecutionAgent, DocumentationAgent). Create minimal stubs that:
- Accept expected input types
- Return valid output types with mock data
- Allow workflow to complete for testing

These stubs will be replaced with real implementations in Checklist 3.

**Testing Strategy:**
- Test FSM with all valid transition sequences
- Test FSM rejects invalid transitions
- Test gate enforcement with valid and invalid inputs
- Test context resolution with sample config
- Test snapshot create/restore cycle
- Test full orchestrator flow with stubs

---

*This checklist establishes the workflow infrastructure that enforces the sequential, gated execution model.*
