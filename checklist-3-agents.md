# Checklist 3: Multi-Agent System & Checklist Execution

**Project:** Tideate IDE  
**Phase:** Intelligence Layer  
**Dependencies:** Checklist 1 (Verification), Checklist 2 (Workflow Engine)  
**Enables:** Full autonomous task execution, Checklist-driven development

---

## PROGRESS TRACKING

**Overall Completion:** 0% (0/31 items)

**Section 1 (LLM Client Abstraction):** 0/4 items  
**Section 2 (Planning Agent):** 0/5 items  
**Section 3 (Auditing Agent):** 0/5 items  
**Section 4 (Execution Agent):** 0/6 items  
**Section 5 (Documentation Agent):** 0/4 items  
**Section 6 (Checklist Parser & Executor):** 0/7 items  

**Current Focus:** Section 1 - LLM Client Abstraction

---

## Section 1: LLM Client Abstraction

Common interface for AI interactions used by all agents.

### 1.1 LLM Client Interface
- [ ] Create `src/core/llm/LLMClient.ts`
- [ ] Define `LLMCompletionRequest` interface: systemPrompt, userPrompt, responseFormat ('text' | 'json'), maxTokens, temperature
- [ ] Define `LLMCompletionResponse` interface: content, usage (tokens), model
- [ ] Define `LLMClient` interface with `complete(request): Promise<LLMCompletionResponse>` method
- **Acceptance Criteria:**
  - Interface is flexible enough for different LLM providers
  - Request/response types are well-defined

### 1.2 Anthropic Implementation
- [ ] Create `src/core/llm/AnthropicClient.ts`
- [ ] Implement `AnthropicClient` class implementing `LLMClient`
- [ ] Handle API key from VS Code settings or environment
- [ ] Implement `complete()` method using Anthropic API
- [ ] Handle JSON response format (parse and validate)
- [ ] Include error handling for API failures, rate limits
- **Acceptance Criteria:**
  - Successfully calls Anthropic API
  - Handles errors gracefully
  - Parses JSON responses when requested

### 1.3 Mock LLM Client
- [ ] Create `src/core/llm/MockLLMClient.ts`
- [ ] Implement `MockLLMClient` for testing without API calls
- [ ] Accept predefined responses in constructor
- [ ] Return appropriate mock response based on prompt content
- **Acceptance Criteria:**
  - Can be used for unit testing agents
  - Returns predictable responses

### 1.4 LLM Client Factory
- [ ] Create `src/core/llm/LLMClientFactory.ts`
- [ ] Implement factory that returns appropriate client based on configuration
- [ ] Support 'anthropic', 'mock', and future providers
- [ ] Read provider preference from VS Code settings
- **Acceptance Criteria:**
  - Factory returns correct client type
  - Easy to add new providers

---

## Section 2: Planning Agent

Creates execution plans from tasks and context.

### 2.1 Planning Agent Base
- [ ] Create `src/core/agents/PlanningAgent.ts`
- [ ] Define `ExecutionPlan` interface:
  - taskId: string
  - objective: string
  - steps: PlanStep[]
  - estimatedChanges: FileChange[]
  - risks: Risk[]
  - rollbackStrategy: string
- [ ] Define `PlanStep` interface: id, type ('create-file' | 'modify-file' | 'delete-file' | 'run-command'), description, target, details
- [ ] Define `Risk` interface: description, severity, mitigation
- [ ] Implement `PlanningAgent` class with LLMClient and ContextResolver dependencies
- **Acceptance Criteria:**
  - All interfaces match TDD specifications
  - Agent instantiates with dependencies

### 2.2 Planning Prompt Construction
- [ ] Define `PLANNING_SYSTEM_PROMPT` constant with agent role and output format instructions
- [ ] Implement `buildPlanningPrompt(task, contexts)` private method
- [ ] Include task description in prompt
- [ ] Include resolved context documents in prompt
- [ ] Specify JSON output format matching ExecutionPlan interface
- [ ] Include instructions for identifying risks and rollback strategy
- **Acceptance Criteria:**
  - System prompt clearly defines agent role
  - User prompt includes all relevant context
  - Output format is clearly specified

### 2.3 Plan Creation
- [ ] Implement `createPlan(task: Task, contexts: ContextItem[]): Promise<ExecutionPlan>` method
- [ ] Call LLM with constructed prompts
- [ ] Request JSON response format
- [ ] Parse response into ExecutionPlan
- [ ] Implement `parsePlanResponse(response)` private method with validation
- **Acceptance Criteria:**
  - Successfully generates plan from task
  - Parses LLM response into structured plan
  - Handles malformed responses gracefully

### 2.4 Plan Validation
- [ ] Implement `validatePlanStructure(plan)` private method
- [ ] Verify objective exists and is meaningful (>10 chars)
- [ ] Verify steps array is non-empty
- [ ] Verify each step has required fields (type, description)
- [ ] Verify rollbackStrategy exists
- [ ] Throw descriptive errors for validation failures
- **Acceptance Criteria:**
  - Catches missing required fields
  - Provides clear error messages

### 2.5 Plan Refinement
- [ ] Implement `refinePlan(plan: ExecutionPlan, feedback: string): Promise<ExecutionPlan>` method
- [ ] Include original plan and feedback in refinement prompt
- [ ] Request updated plan addressing feedback
- [ ] Return refined plan
- **Acceptance Criteria:**
  - Can refine plan based on audit feedback
  - Maintains plan structure in refinement

---

## Section 3: Auditing Agent

Reviews plans for issues before execution.

### 3.1 Auditing Agent Base
- [ ] Create `src/core/agents/AuditingAgent.ts`
- [ ] Define `AuditReport` interface:
  - planId: string
  - approval: 'approved' | 'conditional' | 'rejected'
  - issues: AuditIssue[]
  - autoFixable: boolean
  - suggestions: string[]
  - securityConcerns: string[]
- [ ] Define `AuditIssue` interface: type, severity, message, location, suggestedFix, autoFixable
- [ ] Implement `AuditingAgent` class with LLMClient dependency
- **Acceptance Criteria:**
  - Interfaces match TDD specifications
  - Agent instantiates correctly

### 3.2 Audit Prompt Construction
- [ ] Define `AUDITING_SYSTEM_PROMPT` constant with reviewer role and checklist
- [ ] Implement `buildAuditPrompt(plan)` private method
- [ ] Include full plan as JSON in prompt
- [ ] Include audit checklist:
  1. Does plan address stated objective?
  2. Are all necessary files identified?
  3. Are there security concerns?
  4. Is error handling considered?
  5. Is rollback strategy sufficient?
  6. Are there architectural violations?
- [ ] Specify response format matching AuditReport interface
- **Acceptance Criteria:**
  - Audit checklist covers key concerns
  - Response format is clearly specified

### 3.3 Plan Review
- [ ] Implement `review(plan: ExecutionPlan): Promise<AuditReport>` method
- [ ] Call LLM with audit prompt
- [ ] Parse response into AuditReport
- [ ] Implement `parseAuditResponse(response)` private method
- **Acceptance Criteria:**
  - Successfully reviews plan
  - Returns structured audit report

### 3.4 Issue Classification
- [ ] Implement logic to classify issues by severity (critical, high, medium, low)
- [ ] Implement logic to determine if issues are auto-fixable
- [ ] Auto-fixable criteria: missing null checks, simple import fixes, formatting issues
- [ ] Non-auto-fixable: architectural changes, security decisions, ambiguous requirements
- **Acceptance Criteria:**
  - Issues are correctly classified by severity
  - Auto-fixable flag is accurate

### 3.5 Approval Determination
- [ ] Implement approval logic based on issues:
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
- [ ] Create `src/core/agents/ExecutionAgent.ts`
- [ ] Define `TaskResult` interface (from TDD):
  - taskId, task, success, filesCreated, filesModified, filesDeleted, console, errors
- [ ] Define `FileInfo` interface: path, content (optional), changeType
- [ ] Implement `ExecutionAgent` class with LLMClient and FileSystemService dependencies
- **Acceptance Criteria:**
  - Interfaces match TDD specifications
  - Agent instantiates with dependencies

### 4.2 File System Service
- [ ] Create `src/core/services/FileSystemService.ts`
- [ ] Implement `readFile(path): Promise<string>` method
- [ ] Implement `writeFile(path, content): Promise<void>` method
- [ ] Implement `deleteFile(path): Promise<void>` method
- [ ] Implement `exists(path): Promise<boolean>` method
- [ ] Implement `createDirectory(path): Promise<void>` method (recursive)
- [ ] All operations relative to workspace root
- **Acceptance Criteria:**
  - All file operations work correctly
  - Handles missing directories gracefully

### 4.3 Step Execution
- [ ] Implement `execute(plan: ExecutionPlan): Promise<TaskResult>` method
- [ ] Initialize empty TaskResult
- [ ] Iterate through plan.steps and execute each
- [ ] Implement `executeStep(step, result)` private method with switch on step.type
- [ ] Track created, modified, deleted files in result
- [ ] Catch errors and add to result.errors
- **Acceptance Criteria:**
  - Executes all plan steps in order
  - Tracks all file changes
  - Handles errors without crashing

### 4.4 Code Generation
- [ ] Implement `createFile(step, result)` private method
- [ ] Build prompt for code generation including step details and context
- [ ] Call LLM to generate file content
- [ ] Write generated content to target path
- [ ] Add to result.filesCreated
- [ ] Implement `modifyFile(step, result)` private method
- [ ] Read existing file content
- [ ] Build prompt including current content and requested changes
- [ ] Call LLM to generate modified content
- [ ] Write modified content
- [ ] Add to result.filesModified
- **Acceptance Criteria:**
  - Successfully generates new files
  - Successfully modifies existing files
  - LLM receives appropriate context

### 4.5 Correction Execution
- [ ] Implement `executeCorrection(context: CorrectionContext): Promise<CorrectionAttemptResult>` method
- [ ] Define `CorrectionContext` interface: originalTask, issues, prompt, constraints
- [ ] Parse issues to identify target files
- [ ] Generate fixes for identified issues
- [ ] Apply fixes with minimal changes (respect constraints.minimalChanges)
- [ ] Return changes made
- **Acceptance Criteria:**
  - Generates targeted fixes for specific issues
  - Respects minimal change constraint
  - Returns accurate list of changes

### 4.6 Command Execution
- [ ] Implement `runCommand(step, result)` private method
- [ ] Execute shell command using child_process
- [ ] Capture stdout and stderr
- [ ] Add output to result.console
- [ ] Handle command failures appropriately
- **Acceptance Criteria:**
  - Successfully runs shell commands
  - Captures output
  - Handles failures gracefully

---

## Section 5: Documentation Agent

Updates changelog and checklist after execution.

### 5.1 Documentation Agent Base
- [ ] Create `src/core/agents/DocumentationAgent.ts`
- [ ] Define `DocumentationResult` interface: success, changelogUpdated, checklistUpdated, error
- [ ] Implement `DocumentationAgent` class with dependencies:
  - ChangelogManager (from Checklist 1)
  - ChecklistManager (from Checklist 1)
  - DocumentValidator (from Checklist 1)
- **Acceptance Criteria:**
  - Agent instantiates with dependencies

### 5.2 Documentation Update Flow
- [ ] Implement `updateDocumentation(result: TaskResult): Promise<DocumentationResult>` method
- [ ] Capture "before" state of changelog and checklist
- [ ] Format and add changelog entry
- [ ] Mark checklist item complete (if result.task.checklistItem exists)
- [ ] Capture "after" state
- [ ] Validate changes using DocumentValidator
- [ ] Rollback on validation failure
- **Acceptance Criteria:**
  - Updates both changelog and checklist
  - Validates updates before committing
  - Rolls back on validation failure

### 5.3 Changelog Entry Formatting
- [ ] Implement `formatChangelogEntry(result: TaskResult): string` private method
- [ ] Include date in format `## [YYYY-MM-DD] - Task Name`
- [ ] Include "Completed" section with task description
- [ ] Include "Files Created" section listing created files
- [ ] Include "Files Modified" section listing modified files
- [ ] Follow format specified in TDD
- **Acceptance Criteria:**
  - Entry format matches TDD specification
  - All relevant information is included

### 5.4 Safe Documentation Update
- [ ] Implement atomic update pattern:
  1. Read current state
  2. Prepare new state
  3. Validate new state
  4. Write only if valid
- [ ] On any error, ensure original state is preserved
- [ ] Log documentation update success/failure
- **Acceptance Criteria:**
  - Documentation is never left in invalid state
  - Original state is preserved on failure

---

## Section 6: Checklist Parser & Autonomous Executor

Parses checklists and executes tasks autonomously.

### 6.1 Checklist Parser
- [ ] Create `src/core/workflow/ChecklistParser.ts`
- [ ] Define `ChecklistItem` interface:
  - id, title, description, completed, subtasks, acceptanceCriteria, priority, phase
- [ ] Implement `ChecklistParser` class
- [ ] Implement `parse(markdown: string): ChecklistItem[]` method
- [ ] Parse phase headers (`## Phase N`)
- [ ] Parse main checkbox items (`- [ ] Item` or `- [x] Item`)
- [ ] Parse subtasks (indented checkboxes)
- [ ] Parse acceptance criteria (`- Acceptance: ...`)
- **Acceptance Criteria:**
  - Correctly parses standard checklist format
  - Extracts all item metadata
  - Handles nested subtasks

### 6.2 Checklist Query Methods
- [ ] Implement `getNextUncompleted(items: ChecklistItem[]): ChecklistItem | null` method
- [ ] Return first item where completed=false
- [ ] Implement `calculateProgress(items): Progress` method
- [ ] Define `Progress` interface: overall {total, completed, percentage}, byPhase
- [ ] Calculate completion percentages overall and by phase
- **Acceptance Criteria:**
  - Correctly identifies next uncompleted item
  - Accurately calculates progress

### 6.3 Autonomous Executor Base
- [ ] Create `src/core/workflow/AutonomousExecutor.ts`
- [ ] Define `AutonomousConfig` interface:
  - pauseBetweenTasks: boolean
  - pauseDuration: number (ms)
  - maxConsecutiveTasks: number
  - stopOnFailure: boolean
  - requireConfirmation: boolean
- [ ] Define `AutonomousResult` interface:
  - tasksAttempted, tasksSucceeded, tasksFailed, results, stoppedByUser
- [ ] Implement `AutonomousExecutor` class with dependencies:
  - WorkflowOrchestrator
  - ChecklistParser
  - ChecklistManager
  - AutonomousConfig
- **Acceptance Criteria:**
  - Configuration options match TDD
  - Executor instantiates with dependencies

### 6.4 Autonomous Execution Loop
- [ ] Implement `start(): Promise<AutonomousResult>` method
- [ ] Track execution state (isRunning, shouldStop, currentTaskIndex)
- [ ] Main loop:
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
- [ ] Implement `stop(): void` method to halt execution
- [ ] Implement `isExecuting(): boolean` method
- [ ] Implement `pause(): void` and `resume(): void` methods
- [ ] Handle confirmation requests (if requireConfirmation=true)
- [ ] Implement VS Code dialog integration for confirmations
- **Acceptance Criteria:**
  - Can stop execution mid-run
  - Confirmation dialogs work correctly
  - State is accurately reported

### 6.6 Item to Task Conversion
- [ ] Implement `itemToTask(item: ChecklistItem): Task` private method
- [ ] Define `Task` interface: id, name, description, checklistItem, acceptanceCriteria
- [ ] Map checklist item fields to task fields
- [ ] Include acceptance criteria for verification
- **Acceptance Criteria:**
  - Correctly converts checklist items to tasks
  - All relevant information is transferred

### 6.7 Progress Reporting
- [ ] Implement progress events during autonomous execution
- [ ] Report: current item, progress percentage, time elapsed, tasks completed/failed
- [ ] Integrate with VS Code progress API for UI feedback
- [ ] Log detailed execution history
- **Acceptance Criteria:**
  - Progress is reported in real-time
  - VS Code progress indicator works
  - Execution history is logged

---

## Exit Criteria

Before proceeding to Checklist 4, verify:

- [ ] **LLMClient** successfully calls Anthropic API (or mock for testing)
- [ ] **PlanningAgent** generates valid ExecutionPlans from tasks
- [ ] **AuditingAgent** reviews plans and returns structured AuditReports
- [ ] **ExecutionAgent** creates and modifies files based on plans
- [ ] **DocumentationAgent** updates changelog and checklist with validation
- [ ] **ChecklistParser** correctly parses markdown checklists
- [ ] **AutonomousExecutor** can run multiple tasks from a checklist
- [ ] Full workflow executes: Task → Plan → Audit → Execute → Document → Verify
- [ ] Self-correction loop integrates with ExecutionAgent for fixes
- [ ] All agents handle errors gracefully without crashing
- [ ] No TypeScript errors in agent code

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
