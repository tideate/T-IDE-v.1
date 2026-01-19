# Checklist 3: Multi-Agent System & Checklist Execution

**Project:** Tideate IDE  
**Phase:** Intelligence Layer  
**Dependencies:** Checklist 1 (Verification), Checklist 2 (Workflow Engine)  
**Enables:** Full autonomous task execution, Checklist-driven development

---

## PROGRESS TRACKING

**Overall Completion:** 100% (31/31 items)

**Section 1 (LLM Client Abstraction):** 4/4 items
**Section 2 (Planning Agent):** 5/5 items
**Section 3 (Auditing Agent):** 5/5 items
**Section 4 (Execution Agent):** 6/6 items
**Section 5 (Documentation Agent):** 4/4 items
**Section 6 (Checklist Parser & Executor):** 7/7 items

**Current Focus:** Completed

---

## Section 1: LLM Client Abstraction

Common interface for AI interactions used by all agents.

### 1.1 LLM Client Interface
- [x] Create `src/core/llm/LLMClient.ts`
- [x] Define `LLMCompletionRequest` interface: systemPrompt, userPrompt, responseFormat ('text' | 'json'), maxTokens, temperature
- [x] Define `LLMCompletionResponse` interface: content, usage (tokens), model
- [x] Define `LLMClient` interface with `complete(request): Promise<LLMCompletionResponse>` method
- **Acceptance Criteria:**
  - Interface is flexible enough for different LLM providers
  - Request/response types are well-defined

### 1.2 Anthropic Implementation
- [x] Create `src/core/llm/AnthropicClient.ts`
- [x] Implement `AnthropicClient` class implementing `LLMClient`
- [x] Handle API key from VS Code settings or environment
- [x] Implement `complete()` method using Anthropic API
- [x] Handle JSON response format (parse and validate)
- [x] Include error handling for API failures, rate limits
- **Acceptance Criteria:**
  - Successfully calls Anthropic API
  - Handles errors gracefully
  - Parses JSON responses when requested

### 1.3 Mock LLM Client
- [x] Create `src/core/llm/MockLLMClient.ts`
- [x] Implement `MockLLMClient` for testing without API calls
- [x] Accept predefined responses in constructor
- [x] Return appropriate mock response based on prompt content
- **Acceptance Criteria:**
  - Can be used for unit testing agents
  - Returns predictable responses

### 1.4 LLM Client Factory
- [x] Create `src/core/llm/LLMClientFactory.ts`
- [x] Implement factory that returns appropriate client based on configuration
- [x] Support 'anthropic', 'mock', and future providers
- [x] Read provider preference from VS Code settings
- **Acceptance Criteria:**
  - Factory returns correct client type
  - Easy to add new providers

---

## Section 2: Planning Agent

Creates execution plans from tasks and context.

### 2.1 Planning Agent Base
- [x] Create `src/core/agents/PlanningAgent.ts`
- [x] Define `ExecutionPlan` interface:
  - taskId: string
  - objective: string
  - steps: PlanStep[]
  - estimatedChanges: FileChange[]
  - risks: Risk[]
  - rollbackStrategy: string
- [x] Define `PlanStep` interface: id, type ('create-file' | 'modify-file' | 'delete-file' | 'run-command'), description, target, details
- [x] Define `Risk` interface: description, severity, mitigation
- [x] Implement `PlanningAgent` class with LLMClient and ContextResolver dependencies
- **Acceptance Criteria:**
  - All interfaces match TDD specifications
  - Agent instantiates with dependencies

### 2.2 Planning Prompt Construction
- [x] Define `PLANNING_SYSTEM_PROMPT` constant with agent role and output format instructions
- [x] Implement `buildPlanningPrompt(task, contexts)` private method
- [x] Include task description in prompt
- [x] Include resolved context documents in prompt
- [x] Specify JSON output format matching ExecutionPlan interface
- [x] Include instructions for identifying risks and rollback strategy
- **Acceptance Criteria:**
  - System prompt clearly defines agent role
  - User prompt includes all relevant context
  - Output format is clearly specified

### 2.3 Plan Creation
- [x] Implement `createPlan(task: Task, contexts: ContextItem[]): Promise<ExecutionPlan>` method
- [x] Call LLM with constructed prompts
- [x] Request JSON response format
- [x] Parse response into ExecutionPlan
- [x] Implement `parsePlanResponse(response)` private method with validation
- **Acceptance Criteria:**
  - Successfully generates plan from task
  - Parses LLM response into structured plan
  - Handles malformed responses gracefully

### 2.4 Plan Validation
- [x] Implement `validatePlanStructure(plan)` private method
- [x] Verify objective exists and is meaningful (>10 chars)
- [x] Verify steps array is non-empty
- [x] Verify each step has required fields (type, description)
- [x] Verify rollbackStrategy exists
- [x] Throw descriptive errors for validation failures
- **Acceptance Criteria:**
  - Catches missing required fields
  - Provides clear error messages

### 2.5 Plan Refinement
- [x] Implement `refinePlan(plan: ExecutionPlan, feedback: string): Promise<ExecutionPlan>` method
- [x] Include original plan and feedback in refinement prompt
- [x] Request updated plan addressing feedback
- [x] Return refined plan
- **Acceptance Criteria:**
  - Can refine plan based on audit feedback
  - Maintains plan structure in refinement

---

## Section 3: Auditing Agent

Reviews plans for issues before execution.

### 3.1 Auditing Agent Base
- [x] Create `src/core/agents/AuditingAgent.ts`
- [x] Define `AuditReport` interface:
  - planId: string
  - approval: 'approved' | 'conditional' | 'rejected'
  - issues: AuditIssue[]
  - autoFixable: boolean
  - suggestions: string[]
  - securityConcerns: string[]
- [x] Define `AuditIssue` interface: type, severity, message, location, suggestedFix, autoFixable
- [x] Implement `AuditingAgent` class with LLMClient dependency
- **Acceptance Criteria:**
  - Interfaces match TDD specifications
  - Agent instantiates correctly

### 3.2 Audit Prompt Construction
- [x] Define `AUDITING_SYSTEM_PROMPT` constant with reviewer role and checklist
- [x] Implement `buildAuditPrompt(plan)` private method
- [x] Include full plan as JSON in prompt
- [x] Include audit checklist:
  1. Does plan address stated objective?
  2. Are all necessary files identified?
  3. Are there security concerns?
  4. Is error handling considered?
  5. Is rollback strategy sufficient?
  6. Are there architectural violations?
- [x] Specify response format matching AuditReport interface
- **Acceptance Criteria:**
  - Audit checklist covers key concerns
  - Response format is clearly specified

### 3.3 Plan Review
- [x] Implement `review(plan: ExecutionPlan): Promise<AuditReport>` method
- [x] Call LLM with audit prompt
- [x] Parse response into AuditReport
- [x] Implement `parseAuditResponse(response)` private method
- **Acceptance Criteria:**
  - Successfully reviews plan
  - Returns structured audit report

### 3.4 Issue Classification
- [x] Implement logic to classify issues by severity (critical, high, medium, low)
- [x] Implement logic to determine if issues are auto-fixable
- [x] Auto-fixable criteria: missing null checks, simple import fixes, formatting issues
- [x] Non-auto-fixable: architectural changes, security decisions, ambiguous requirements
- **Acceptance Criteria:**
  - Issues are correctly classified by severity
  - Auto-fixable flag is accurate

### 3.5 Approval Determination
- [x] Implement approval logic based on issues:
  - No issues → 'approved'
  - Only auto-fixable issues → 'conditional' with autoFixable=true
  - Any critical issues → 'rejected'
  - Non-auto-fixable high issues → 'rejected'
  - Only medium/low non-auto-fixable → 'conditional' with autoFixable=false
- **Acceptance Criteria:**
  - Approval status correctly reflects issue severity
  - Conditional approvals correctly indicate fixability

---

## Section 4: Execution Agent

Generates and modifies code based on approved plans.

### 4.1 Execution Agent Base
- [x] Create `src/core/agents/ExecutionAgent.ts`
- [x] Define `TaskResult` interface (from TDD):
  - taskId, task, success, filesCreated, filesModified, filesDeleted, console, errors
- [x] Define `FileInfo` interface: path, content (optional), changeType
- [x] Implement `ExecutionAgent` class with LLMClient and FileSystemService dependencies
- **Acceptance Criteria:**
  - Interfaces match TDD specifications
  - Agent instantiates with dependencies

### 4.2 File System Service
- [x] Create `src/core/services/FileSystemService.ts`
- [x] Implement `readFile(path): Promise<string>` method
- [x] Implement `writeFile(path, content): Promise<void>` method
- [x] Implement `deleteFile(path): Promise<void>` method
- [x] Implement `exists(path): Promise<boolean>` method
- [x] Implement `createDirectory(path): Promise<void>` method (recursive)
- [x] All operations relative to workspace root
- **Acceptance Criteria:**
  - All file operations work correctly
  - Handles missing directories gracefully

### 4.3 Step Execution
- [x] Implement `execute(plan: ExecutionPlan): Promise<TaskResult>` method
- [x] Initialize empty TaskResult
- [x] Iterate through plan.steps and execute each
- [x] Implement `executeStep(step, result)` private method with switch on step.type
- [x] Track created, modified, deleted files in result
- [x] Catch errors and add to result.errors
- **Acceptance Criteria:**
  - Executes all plan steps in order
  - Tracks all file changes
  - Handles errors without crashing

### 4.4 Code Generation
- [x] Implement `createFile(step, result)` private method
- [x] Build prompt for code generation including step details and context
- [x] Call LLM to generate file content
- [x] Write generated content to target path
- [x] Add to result.filesCreated
- [x] Implement `modifyFile(step, result)` private method
- [x] Read existing file content
- [x] Build prompt including current content and requested changes
- [x] Call LLM to generate modified content
- [x] Write modified content
- [x] Add to result.filesModified
- **Acceptance Criteria:**
  - Successfully generates new files
  - Successfully modifies existing files
  - LLM receives appropriate context

### 4.5 Correction Execution
- [x] Implement `executeCorrection(context: CorrectionContext): Promise<CorrectionAttemptResult>` method
- [x] Define `CorrectionContext` interface: originalTask, issues, prompt, constraints
- [x] Parse issues to identify target files
- [x] Generate fixes for identified issues
- [x] Apply fixes with minimal changes (respect constraints.minimalChanges)
- [x] Return changes made
- **Acceptance Criteria:**
  - Generates targeted fixes for specific issues
  - Respects minimal change constraint
  - Returns accurate list of changes

### 4.6 Command Execution
- [x] Implement `runCommand(step, result)` private method
- [x] Execute shell command using child_process
- [x] Capture stdout and stderr
- [x] Add output to result.console
- [x] Handle command failures appropriately
- **Acceptance Criteria:**
  - Successfully runs shell commands
  - Captures output
  - Handles failures gracefully

---

## Section 5: Documentation Agent

Updates changelog and checklist after execution.

### 5.1 Documentation Agent Base
- [x] Create `src/core/agents/DocumentationAgent.ts`
- [x] Define `DocumentationResult` interface: success, changelogUpdated, checklistUpdated, error
- [x] Implement `DocumentationAgent` class with dependencies:
  - ChangelogManager (from Checklist 1)
  - ChecklistManager (from Checklist 1)
  - DocumentValidator (from Checklist 1)
- **Acceptance Criteria:**
  - Agent instantiates with dependencies

### 5.2 Documentation Update Flow
- [x] Implement `updateDocumentation(result: TaskResult): Promise<DocumentationResult>` method
- [x] Capture "before" state of changelog and checklist
- [x] Format and add changelog entry
- [x] Mark checklist item complete (if result.task.checklistItem exists)
- [x] Capture "after" state
- [x] Validate changes using DocumentValidator
- [x] Rollback on validation failure
- **Acceptance Criteria:**
  - Updates both changelog and checklist
  - Validates updates before committing
  - Rolls back on validation failure

### 5.3 Changelog Entry Formatting
- [x] Implement `formatChangelogEntry(result: TaskResult): string` private method
- [x] Include date in format `## [YYYY-MM-DD] - Task Name`
- [x] Include "Completed" section with task description
- [x] Include "Files Created" section listing created files
- [x] Include "Files Modified" section listing modified files
- [x] Follow format specified in TDD
- **Acceptance Criteria:**
  - Entry format matches TDD specification
  - All relevant information is included

### 5.4 Safe Documentation Update
- [x] Implement atomic update pattern:
  1. Read current state
  2. Prepare new state
  3. Validate new state
  4. Write only if valid
- [x] On any error, ensure original state is preserved
- [x] Log documentation update success/failure
- **Acceptance Criteria:**
  - Documentation is never left in invalid state
  - Original state is preserved on failure

---

## Section 6: Checklist Parser & Autonomous Executor

Parses checklists and executes tasks autonomously.

### 6.1 Checklist Parser
- [x] Create `src/core/workflow/ChecklistParser.ts`
- [x] Define `ChecklistItem` interface:
  - id, title, description, completed, subtasks, acceptanceCriteria, priority, phase
- [x] Implement `ChecklistParser` class
- [x] Implement `parse(markdown: string): ChecklistItem[]` method
- [x] Parse phase headers (`## Phase N`)
- [x] Parse main checkbox items (`- [ ] Item` or `- [x] Item`)
- [x] Parse subtasks (indented checkboxes)
- [x] Parse acceptance criteria (`- Acceptance: ...`)
- **Acceptance Criteria:**
  - Correctly parses standard checklist format
  - Extracts all item metadata
  - Handles nested subtasks

### 6.2 Checklist Query Methods
- [x] Implement `getNextUncompleted(items: ChecklistItem[]): ChecklistItem | null` method
- [x] Return first item where completed=false
- [x] Implement `calculateProgress(items): Progress` method
- [x] Define `Progress` interface: overall {total, completed, percentage}, byPhase
- [x] Calculate completion percentages overall and by phase
- **Acceptance Criteria:**
  - Correctly identifies next uncompleted item
  - Accurately calculates progress

### 6.3 Autonomous Executor Base
- [x] Create `src/core/workflow/AutonomousExecutor.ts`
- [x] Define `AutonomousConfig` interface:
  - pauseBetweenTasks: boolean
  - pauseDuration: number (ms)
  - maxConsecutiveTasks: number
  - stopOnFailure: boolean
  - requireConfirmation: boolean
- [x] Define `AutonomousResult` interface:
  - tasksAttempted, tasksSucceeded, tasksFailed, results, stoppedByUser
- [x] Implement `AutonomousExecutor` class with dependencies:
  - WorkflowOrchestrator
  - ChecklistParser
  - ChecklistManager
  - AutonomousConfig
- **Acceptance Criteria:**
  - Configuration options match TDD
  - Executor instantiates with dependencies

### 6.4 Autonomous Execution Loop
- [x] Implement `start(): Promise<AutonomousResult>` method
- [x] Track execution state (isRunning, shouldStop, currentTaskIndex)
- [x] Main loop:
  1. Parse current checklist state
  2. Get next uncompleted item
  3. If none, exit with success
  4. Check consecutive task limit
  5. Convert checklist item to Task
  6. Execute via WorkflowOrchestrator
  7. Record result
  8. Handle failure (stop if configured)
  9. Pause if configured
  10. Repeat
- **Acceptance Criteria:**
  - Processes checklist items sequentially
  - Respects configuration options
  - Stops appropriately on completion or failure

### 6.5 Execution Control
- [x] Implement `stop(): void` method to halt execution
- [x] Implement `isExecuting(): boolean` method
- [x] Implement `pause(): void` and `resume(): void` methods
- [x] Handle confirmation requests (if requireConfirmation=true)
- [x] Implement VS Code dialog integration for confirmations
- **Acceptance Criteria:**
  - Can stop execution mid-run
  - Confirmation dialogs work correctly
  - State is accurately reported

### 6.6 Item to Task Conversion
- [x] Implement `itemToTask(item: ChecklistItem): Task` private method
- [x] Define `Task` interface: id, name, description, checklistItem, acceptanceCriteria
- [x] Map checklist item fields to task fields
- [x] Include acceptance criteria for verification
- **Acceptance Criteria:**
  - Correctly converts checklist items to tasks
  - All relevant information is transferred

### 6.7 Progress Reporting
- [x] Implement progress events during autonomous execution
- [x] Report: current item, progress percentage, time elapsed, tasks completed/failed
- [x] Integrate with VS Code progress API for UI feedback
- [x] Log detailed execution history
- **Acceptance Criteria:**
  - Progress is reported in real-time
  - VS Code progress indicator works
  - Execution history is logged

---

## Exit Criteria

Before proceeding to Checklist 4, verify:

- [x] **LLMClient** successfully calls Anthropic API (or mock for testing)
- [x] **PlanningAgent** generates valid ExecutionPlans from tasks
- [x] **AuditingAgent** reviews plans and returns structured AuditReports
- [x] **ExecutionAgent** creates and modifies files based on plans
- [x] **DocumentationAgent** updates changelog and checklist with validation
- [x] **ChecklistParser** correctly parses markdown checklists
- [x] **AutonomousExecutor** can run multiple tasks from a checklist
- [x] Full workflow executes: Task → Plan → Audit → Execute → Document → Verify
- [x] Self-correction loop integrates with ExecutionAgent for fixes
- [x] All agents handle errors gracefully without crashing
- [x] No TypeScript errors in agent code

---

## Notes for Builder

**Key Files to Create:**
```
src/core/llm/
├── LLMClient.ts
├── AnthropicClient.ts
├── MockLLMClient.ts
└── LLMClientFactory.ts

src/core/agents/
├── PlanningAgent.ts
├── AuditingAgent.ts
├── ExecutionAgent.ts
└── DocumentationAgent.ts

src/core/services/
└── FileSystemService.ts

src/core/workflow/
├── ChecklistParser.ts
└── AutonomousExecutor.ts
```

**Integration Points:**
- All agents use LLMClient for AI interactions
- ExecutionAgent uses FileSystemService for file operations
- DocumentationAgent uses managers from Checklist 1
- AutonomousExecutor uses WorkflowOrchestrator from Checklist 2
- SelfCorrectionLoop (Checklist 1) calls ExecutionAgent.executeCorrection()

**API Key Handling:**
- Store Anthropic API key in VS Code settings (secrets API preferred)
- Never log or expose API keys
- Support environment variable fallback for CI/CD

**Testing Strategy:**
- Use MockLLMClient for unit tests
- Create sample checklists for parser testing
- Test autonomous executor with small test checklists
- Integration test full workflow with mock LLM

---

*This checklist establishes the AI agent system that powers autonomous development.*
