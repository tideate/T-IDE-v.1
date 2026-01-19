# Checklist 1: Core Verification Layer

**Project:** Tideate IDE  
**Phase:** Foundation  
**Dependencies:** None (this is the foundation)  
**Enables:** Workflow Engine, Self-Correction, All subsequent checklists

---

## PROGRESS TRACKING

**Overall Completion:** 29% (7/24 items)

**Section 1 (Verification Pipeline):** 7/7 items
**Section 2 (Document Integrity):** 0/6 items  
**Section 3 (Runtime Error Detection):** 0/5 items  
**Section 4 (Holistic Consistency Checker):** 0/4 items  
**Section 5 (Self-Correction Loop):** 0/6 items  

**Current Focus:** Section 1 - Verification Pipeline

---

## Section 1: Verification Pipeline

The deterministic (non-AI) checks that validate code quality.

### 1.1 Verification Pipeline Base Structure
- [x] Create `src/core/verification/VerificationPipeline.ts`
- [x] Define `VerificationReport` interface with fields: timestamp, passed, typescript, eslint, tests, build, documentation
- [x] Define `CheckResult` interface with fields: passed, errors array
- [x] Define `TestResult` interface extending CheckResult with: total, passed, failed, failures array
- [x] Implement `VerificationPipeline` class with constructor accepting workspace root path
- [x] Implement `runAll()` method that orchestrates all checks and returns `VerificationReport`
- **Acceptance Criteria:**
  - Pipeline class instantiates without error
  - `runAll()` returns properly structured `VerificationReport`

### 1.2 TypeScript Compilation Check
- [x] Implement `runTypeScript()` private method in VerificationPipeline
- [x] Execute `npx tsc --noEmit` using child_process exec
- [x] Parse TypeScript error output into structured format (file, line, column, code, message)
- [x] Return `CheckResult` with passed status and parsed errors
- **Acceptance Criteria:**
  - Detects TypeScript errors in test files
  - Returns clean result for valid TypeScript

### 1.3 ESLint Check
- [x] Implement `runESLint()` private method
- [x] Execute `npx eslint . --ext .ts,.tsx --format json`
- [x] Parse JSON output into structured error format (file, line, message, severity)
- [x] Differentiate between errors (fail) and warnings (pass with warnings)
- [x] Return `CheckResult` with appropriate status
- **Acceptance Criteria:**
  - Detects ESLint errors and warnings
  - Only fails on actual errors, not warnings

### 1.4 Test Execution Check
- [x] Implement `runTests()` private method
- [x] Execute `npm test -- --json` (assumes Jest or compatible runner)
- [x] Parse test output for pass/fail counts and failure details
- [x] Handle case where no tests exist gracefully
- [x] Return `TestResult` with full breakdown
- **Acceptance Criteria:**
  - Correctly reports test pass/fail status
  - Captures failure messages for failed tests

### 1.5 Build Check
- [x] Implement `runBuild()` private method
- [x] Execute `npm run build`
- [x] Capture build errors from stderr
- [x] Return `CheckResult` with status and errors
- **Acceptance Criteria:**
  - Detects build failures
  - Returns clean result for successful builds

### 1.6 Ghost File Detection
- [x] Implement `detectGhostFiles()` private method
- [x] Execute `git ls-files --others --exclude-standard`
- [x] Filter out expected untracked files (node_modules, .env, dist, build, coverage)
- [x] Define `GhostFileResult` interface with passed and unexpectedFiles array
- [x] Return result indicating if unexpected files exist
- **Acceptance Criteria:**
  - Identifies truly unexpected files
  - Ignores standard untracked patterns

### 1.7 Pipeline Integration & Error Handling
- [x] Add try-catch wrappers around all check methods
- [x] Implement graceful degradation (if git unavailable, skip ghost file check)
- [x] Add console logging for pipeline progress
- [x] Ensure pipeline continues running remaining checks if one fails
- **Acceptance Criteria:**
  - Single check failure doesn't crash entire pipeline
  - Clear logging indicates which checks ran

---

## Section 2: Document Integrity System

Validates that documentation is never corrupted.

### 2.1 Document Validator Base
- [ ] Create `src/core/documents/DocumentValidator.ts`
- [ ] Define `ValidationResult` interface with: valid (boolean), reason (optional string)
- [ ] Implement `DocumentValidator` class
- **Acceptance Criteria:**
  - Class instantiates correctly

### 2.2 Changelog Validation
- [ ] Implement `validateChangelog()` method
- [ ] Check changelog file exists at `AGENTS.md/changelog.md`
- [ ] Validate required header `# Changelog` exists
- [ ] Validate date entry format `## [YYYY-MM-DD]` pattern exists
- [ ] Validate entries are in descending date order (newest first)
- [ ] Return `ValidationResult` with specific failure reasons
- **Acceptance Criteria:**
  - Accepts valid changelog format
  - Rejects changelog with missing headers
  - Rejects changelog with wrong date order

### 2.3 Changelog Update Validation
- [ ] Implement `validateChangelogUpdate(before: string, after: string)` method
- [ ] Verify after has more lines than before (append-only)
- [ ] Verify all previous date entries still exist in after
- [ ] Return `ValidationResult` with specific failure reasons
- **Acceptance Criteria:**
  - Rejects updates that delete content
  - Rejects updates that shrink line count
  - Accepts valid append-only updates

### 2.4 Checklist Validation
- [ ] Implement `validateChecklist()` method
- [ ] Check for checklist file existence (support flexible naming: `*-checklist.md`)
- [ ] Validate basic structure (has checkbox items)
- [ ] Return `ValidationResult`
- **Acceptance Criteria:**
  - Finds checklist files with various names
  - Validates basic checkbox structure

### 2.5 Checklist Update Validation
- [ ] Implement `validateChecklistUpdate(before: string, after: string)` method
- [ ] Verify line count stays same or increases
- [ ] Count checkboxes before and after (total should not decrease)
- [ ] Count checked items `[x]` - should only increase (no unchecking)
- [ ] Return `ValidationResult` with specific failure reasons
- **Acceptance Criteria:**
  - Rejects updates that delete items
  - Rejects updates that uncheck items
  - Accepts marking items complete

### 2.6 Document Managers
- [ ] Create `src/core/documents/ChangelogManager.ts`
- [ ] Implement `read()`, `write()`, `addEntry()` methods
- [ ] Create `src/core/documents/ChecklistManager.ts`
- [ ] Implement `read()`, `write()`, `markComplete(itemId)` methods
- [ ] Both managers should use DocumentValidator before writing
- **Acceptance Criteria:**
  - Can read and write changelog
  - Can read, write, and mark checklist items complete
  - Write operations validate before saving

---

## Section 3: Runtime Error Detection

Monitors preview console for errors during execution.

### 3.1 Console Monitor Base
- [ ] Create `src/core/verification/ConsoleMonitor.ts`
- [ ] Define event emitter pattern for 'error', 'warning', 'unhandledrejection' events
- [ ] Implement `attach(previewFrame)` method (stub for now - full integration in Checklist 4)
- [ ] Implement `detach()` method
- **Acceptance Criteria:**
  - Can attach/detach event listeners
  - Emits events when errors occur

### 3.2 Runtime Error Detector
- [ ] Create `src/core/verification/RuntimeErrorDetector.ts`
- [ ] Define `RuntimeError` interface: type, message, stack, location, timestamp, isFatal, suggestedFix
- [ ] Implement `RuntimeErrorDetector` class with ConsoleMonitor dependency
- [ ] Implement `startMonitoring()` method
- [ ] Implement `detect()` method returning array of `RuntimeError`
- [ ] Implement `reset()` method to clear error log
- **Acceptance Criteria:**
  - Can start/stop monitoring
  - Accumulates errors during monitoring period
  - Reset clears accumulated errors

### 3.3 Error Parsing
- [ ] Implement `parseError(rawError)` private method
- [ ] Extract message from various error formats
- [ ] Extract stack trace when available
- [ ] Implement `extractLocation(stack)` to get file:line from stack trace
- [ ] Determine `isFatal` based on error type (uncaught vs console.error)
- **Acceptance Criteria:**
  - Parses standard JavaScript errors
  - Extracts file location from stack traces
  - Correctly identifies fatal vs non-fatal errors

### 3.4 Fix Suggestions
- [ ] Implement `suggestFix(error)` private method
- [ ] Pattern match common errors:
  - "cannot read property" → null check suggestion
  - "is not a function" → import check suggestion
  - "module not found" → install dependency suggestion
  - "network error" → API endpoint check suggestion
  - Firebase permission errors → security rules suggestion
- [ ] Return generic suggestion for unmatched patterns
- **Acceptance Criteria:**
  - Provides relevant suggestions for common error patterns
  - Falls back gracefully for unknown errors

### 3.5 Error Deduplication
- [ ] Implement deduplication logic in `detect()` method
- [ ] Group identical errors (same message and location)
- [ ] Track occurrence count for repeated errors
- [ ] Prioritize by severity (fatal first)
- **Acceptance Criteria:**
  - Same error appearing 10 times shows as 1 error with count
  - Fatal errors sorted before non-fatal

---

## Section 4: Holistic Consistency Checker

Validates cross-cutting concerns that simple linting misses.

### 4.1 Holistic Checker Base
- [ ] Create `src/core/verification/HolisticChecker.ts`
- [ ] Define `VerificationIssue` interface: type, severity, message, location, suggestedFix, details
- [ ] Implement `HolisticConsistencyChecker` class
- [ ] Implement `checkAll(result: TaskResult)` method orchestrating all checks
- **Acceptance Criteria:**
  - Class instantiates correctly
  - `checkAll` returns array of `VerificationIssue`

### 4.2 Import-Export Validation
- [ ] Implement `checkImports(result)` private method
- [ ] Implement `extractImports(code)` helper to parse import statements
- [ ] Implement `extractExports(code)` helper to parse export statements
- [ ] Implement `resolveImportPath(fromFile, importSource)` helper
- [ ] For relative imports: verify target file exists
- [ ] For relative imports: verify imported names are actually exported
- [ ] For npm imports: verify package is in package.json dependencies
- **Acceptance Criteria:**
  - Detects imports from non-existent files
  - Detects imports of non-exported names
  - Detects usage of uninstalled npm packages

### 4.3 Type Consistency Check
- [ ] Implement `checkTypes(result)` private method
- [ ] Scan created/modified files for excessive `any` usage
- [ ] Flag files with more than 3 `any` type annotations
- [ ] Return `VerificationIssue` with medium severity for type issues
- **Acceptance Criteria:**
  - Identifies files with excessive `any` usage
  - Does not flag files with reasonable `any` usage

### 4.4 Code-Documentation Consistency
- [ ] Implement `checkCodeDocConsistency(result)` private method
- [ ] Extract function names mentioned in changelog (pattern: `functionName()`)
- [ ] Extract actual function names from created/modified files
- [ ] Flag documented functions that don't exist in code
- [ ] Return `VerificationIssue` with high severity for missing implementations
- **Acceptance Criteria:**
  - Detects when changelog mentions function that doesn't exist
  - Ignores functions that are properly implemented

---

## Section 5: Self-Correction Loop

The core innovation - AI verifies and fixes its own work.

### 5.1 Self-Correction Loop Base
- [ ] Create `src/core/verification/SelfCorrectionLoop.ts`
- [ ] Define `CorrectionAttempt` interface: attemptNumber, issues, fixStrategy, changes, result, timestamp
- [ ] Define `SelfCorrectionContext` interface: taskId, originalResult, attempts, maxAttempts, currentState
- [ ] Define `CorrectionResult` interface: success, finalResult, attempts, message, remainingIssues, escalationReason
- [ ] Define `FixStrategy` interface: approach, targetIssues, reasoning
- [ ] Implement `SelfCorrectionLoop` class with maxAttempts = 3
- **Acceptance Criteria:**
  - All interfaces properly defined
  - Class instantiates with required dependencies

### 5.2 Verification Orchestration
- [ ] Implement `runAllVerification(result)` private method
- [ ] Call RuntimeErrorDetector.detect()
- [ ] Call HolisticChecker.checkAll()
- [ ] Call VerificationPipeline.runAll()
- [ ] Aggregate all issues into single array
- [ ] Implement `deduplicateAndPrioritize(issues)` to remove duplicates and sort by severity
- **Acceptance Criteria:**
  - Aggregates issues from all three verification sources
  - Deduplicates identical issues
  - Sorts by severity (critical → high → medium → low)

### 5.3 Fix Strategy Determination
- [ ] Implement `determineFixStrategy(issues)` private method
- [ ] Priority logic:
  1. Critical build errors first (can't verify runtime without build)
  2. Runtime errors second (feature doesn't work)
  3. Consistency issues third (code-doc mismatch)
  4. Everything else last
- [ ] Return `FixStrategy` with approach, target issues, and reasoning
- **Acceptance Criteria:**
  - Correctly prioritizes build errors
  - Provides clear reasoning for chosen strategy

### 5.4 Correction Prompt Building
- [ ] Implement `buildCorrectionPrompt(result, strategy)` private method
- [ ] Format issues with severity and location
- [ ] Include constraints: minimal changes, preserve working code, target specific files
- [ ] Implement `identifyTargetFiles(issues)` helper to extract file paths from issues
- [ ] Return formatted prompt string for ExecutionAgent
- **Acceptance Criteria:**
  - Prompt clearly describes issues to fix
  - Prompt includes appropriate constraints
  - Target files are correctly identified

### 5.5 Main Correction Loop
- [ ] Implement `verifyAndCorrect(result)` main method
- [ ] Initialize `SelfCorrectionContext`
- [ ] Loop up to maxAttempts:
  1. Run all verification
  2. If no issues → return success
  3. Record attempt
  4. If last attempt → return escalation
  5. Attempt correction (stub - will call ExecutionAgent)
  6. Update result with changes
- [ ] Return `CorrectionResult` with full history
- **Acceptance Criteria:**
  - Returns success immediately if no issues found
  - Attempts correction up to 3 times
  - Escalates after 3 failed attempts
  - Records all attempts in result

### 5.6 Escalation Formatting
- [ ] Implement `formatEscalationReason(issues)` private method
- [ ] Create clear, actionable message for user
- [ ] Include all unresolved issues with severity
- [ ] Suggest potential manual interventions
- **Acceptance Criteria:**
  - Escalation message is clear and actionable
  - All remaining issues are listed
  - User understands what went wrong

---

## Exit Criteria

Before proceeding to Checklist 2, verify:

- [ ] **VerificationPipeline** runs TypeScript, ESLint, test, and build checks
- [ ] **DocumentValidator** correctly enforces append-only changelog rule
- [ ] **DocumentValidator** correctly prevents checklist item deletion/unchecking
- [ ] **RuntimeErrorDetector** captures and categorizes errors (tested with mock data)
- [ ] **HolisticChecker** detects import/export mismatches
- [ ] **SelfCorrectionLoop** orchestrates verification and tracks attempts
- [ ] All components have basic error handling (don't crash on unexpected input)
- [ ] Unit tests exist for critical validation logic
- [ ] No TypeScript errors in verification layer code
- [ ] Code follows project ESLint rules

---

## Notes for Builder

**Key Files to Create:**
```
src/core/verification/
├── VerificationPipeline.ts
├── SelfCorrectionLoop.ts
├── HolisticChecker.ts
├── RuntimeErrorDetector.ts
└── ConsoleMonitor.ts

src/core/documents/
├── DocumentValidator.ts
├── ChangelogManager.ts
└── ChecklistManager.ts
```

**External Dependencies:**
- Child process exec for running CLI commands
- File system access for reading/writing documents
- TypeScript compiler API (optional, for advanced type checking)

**Testing Strategy:**
- Create test fixtures with intentional errors
- Mock file system for document validation tests
- Mock console output for runtime error detection tests

---

*This checklist establishes the verification foundation that all other Tideate IDE functionality depends on.*
