# Checklist 5: Backend Intelligence Layer

**Project:** Tideate IDE  
**Phase:** Advanced Features  
**Dependencies:** Checklist 2 (Workflow Engine), Checklist 4 (Firebase Integration)  
**Enables:** Automatic backend spec generation, One-click Gemini handoff, Full-stack development automation

---

## PROGRESS TRACKING

**Overall Completion:** 83% (25/30 items)

**Section 1 (Code Analyzer):** 6/6 items
**Section 2 (Requirements Accumulator):** 5/5 items
**Section 3 (Firebase Spec Generator):** 6/6 items
**Section 4 (Gemini Handoff System):** 5/5 items
**Section 5 (Provisioning Verification):** 3/5 items
**Section 6 (UI & Commands):** 0/3 items  

**Current Focus:** Section 5 & 6

---

## Section 1: Code Analyzer

Silently analyzes frontend code to detect Firebase service usage.

### 1.1 AST Parser Setup
- [x] Create `src/backend/tracker/ASTParser.ts`
- [x] Install/configure TypeScript compiler API for AST parsing
- [x] Implement `parse(code: string, filePath: string): AST` method
- [x] Handle TypeScript and JavaScript files
- [x] Handle parsing errors gracefully (return partial AST or null)
- **Acceptance Criteria:**
  - Successfully parses TypeScript/JavaScript files
  - Returns usable AST for analysis
  - Doesn't crash on malformed code

### 1.2 Code Analyzer Base
- [x] Create `src/backend/tracker/CodeAnalyzer.ts`
- [x] Define `AnalysisResult` interface:
  - firestoreCalls: FirestoreCall[]
  - authCalls: AuthCall[]
  - storageCalls: StorageCall[]
  - functionCalls: FunctionCall[]
- [x] Implement `CodeAnalyzer` class with ASTParser dependency
- [x] Implement `analyzeFile(filePath): AnalysisResult` method
- [x] Implement `analyzeCode(code, filePath): AnalysisResult` method
- **Acceptance Criteria:**
  - Can analyze individual files
  - Returns structured analysis results

### 1.3 Firestore Call Detection
- [x] Define `FirestoreCall` interface:
  - collection: string, operation: string ('get' | 'set' | 'update' | 'delete' | 'query'), fields: string[], location: string
- [x] Implement `detectFirestoreCalls(ast): FirestoreCall[]` private method
- [x] Detect patterns:
  - `collection('name')` / `doc('collection/id')`
  - `.get()`, `.set()`, `.update()`, `.delete()`
  - `.where()`, `.orderBy()`, `.limit()` (query operations)
  - `addDoc()`, `setDoc()`, `updateDoc()`, `deleteDoc()`
- [x] Extract collection names from call arguments
- [x] Extract field names from data objects where possible
- **Acceptance Criteria:**
  - Detects Firestore v9 modular syntax
  - Detects Firestore v8 chained syntax
  - Extracts collection and field information

### 1.4 Auth Call Detection
- [x] Define `AuthCall` interface:
  - provider: string, operation: string, location: string
- [x] Implement `detectAuthCalls(ast): AuthCall[]` private method
- [x] Detect patterns:
  - `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`
  - `signInWithPopup`, `signInWithRedirect` (OAuth providers)
  - `signOut`, `onAuthStateChanged`
  - `GoogleAuthProvider`, `FacebookAuthProvider`, etc.
- [x] Extract provider types used
- **Acceptance Criteria:**
  - Detects all common auth patterns
  - Identifies OAuth providers in use

### 1.5 Storage Call Detection
- [x] Define `StorageCall` interface:
  - path: string, operation: string ('upload' | 'download' | 'delete' | 'list'), location: string
- [x] Implement `detectStorageCalls(ast): StorageCall[]` private method
- [x] Detect patterns:
  - `ref(storage, 'path')`, `storageRef`
  - `uploadBytes`, `uploadString`, `uploadBytesResumable`
  - `getDownloadURL`, `getBlob`, `getBytes`
  - `deleteObject`, `listAll`, `list`
- [x] Extract storage paths from arguments
- **Acceptance Criteria:**
  - Detects Storage v9 modular syntax
  - Extracts storage path patterns

### 1.6 Cloud Function Call Detection
- [x] Define `FunctionCall` interface:
  - functionName: string, region: string (optional), location: string
- [x] Implement `detectFunctionCalls(ast): FunctionCall[]` private method
- [x] Detect patterns:
  - `httpsCallable(functions, 'functionName')`
  - `getFunctions()`, `connectFunctionsEmulator()`
- [x] Extract function names
- **Acceptance Criteria:**
  - Detects callable function usage
  - Extracts function names

---

## Section 2: Requirements Accumulator

Aggregates detected requirements across the codebase.

### 2.1 Requirements Accumulator Base
- [x] Create `src/backend/tracker/RequirementsAccumulator.ts`
- [x] Define `BackendRequirements` interface:
  - collections: CollectionRequirement[]
  - authProviders: string[]
  - storagePaths: StoragePathRequirement[]
  - functions: FunctionRequirement[]
  - lastUpdated: Date
- [x] Define sub-interfaces for each requirement type with fields, operations, sources
- [x] Implement `RequirementsAccumulator` class
- **Acceptance Criteria:**
  - Comprehensive requirement structure defined
  - Class instantiates correctly

### 2.2 Requirement Aggregation
- [x] Implement `addAnalysisResult(result: AnalysisResult, sourceFile: string): void` method
- [x] Merge Firestore calls into collections (combine same collection from different files)
- [x] Aggregate fields discovered for each collection
- [x] Aggregate operations (read, write, query) per collection
- [x] Track source files for each requirement (for traceability)
- **Acceptance Criteria:**
  - Multiple files analyzing same collection are merged
  - Fields are accumulated across files
  - Source tracking enables debugging

### 2.3 Full Codebase Scan
- [x] Implement `scanCodebase(srcPath: string): Promise<BackendRequirements>` method
- [x] Recursively find all .ts, .tsx, .js, .jsx files
- [x] Analyze each file with CodeAnalyzer
- [x] Accumulate all results
- [x] Update lastUpdated timestamp
- **Acceptance Criteria:**
  - Scans entire source directory
  - Handles large codebases efficiently
  - Returns complete requirements

### 2.4 Incremental Updates
- [x] Implement `updateFile(filePath: string): void` method for single file re-analysis
- [x] Remove old requirements from that file
- [x] Add new requirements from updated analysis
- [x] Integrate with HotReloadCoordinator for automatic updates
- **Acceptance Criteria:**
  - Single file changes update requirements efficiently
  - Old data from changed file is replaced

### 2.5 Requirements Persistence
- [x] Implement `save(): Promise<void>` method
- [x] Save requirements to `.tideate/backend-requirements.json`
- [x] Implement `load(): Promise<BackendRequirements>` method
- [x] Load requirements on extension activation
- **Acceptance Criteria:**
  - Requirements persist across sessions
  - Load/save cycle preserves all data

---

## Section 3: Firebase Spec Generator

Transforms requirements into Firebase configuration specs.

### 3.1 Spec Generator Base
- [x] Create `src/backend/spec/FirebaseSpecGenerator.ts`
- [x] Define `FirebaseSpec` interface:
  - firestoreSchema: FirestoreSchema
  - securityRules: string (firestore.rules content)
  - storageRules: string (storage.rules content)
  - indexes: FirestoreIndex[]
  - typeDefinitions: string (TypeScript interfaces)
- [x] Implement `FirebaseSpecGenerator` class
- **Acceptance Criteria:**
  - Spec structure covers all Firebase configuration needs

### 3.2 Firestore Schema Generation
- [x] Define `FirestoreSchema` interface:
  - collections: CollectionSchema[] (name, fields with types, subcollections)
- [x] Implement `generateFirestoreSchema(requirements): FirestoreSchema` method
- [x] Infer field types from usage patterns where possible
- [x] Mark unknown types as `any` with TODO comment
- [x] Handle nested subcollections
- **Acceptance Criteria:**
  - Generates schema for all detected collections
  - Infers types where possible
  - Marks ambiguous types clearly

### 3.3 Security Rules Generation
- [x] Create `src/backend/spec/SecurityRulesGenerator.ts`
- [x] Implement `generateFirestoreRules(schema, requirements): string` method
- [x] Generate rules structure matching schema collections
- [x] Default to authenticated read/write (safe starting point)
- [x] Add TODO comments for rules that need customization
- [x] Implement `generateStorageRules(requirements): string` method
- [x] Generate storage rules based on detected paths
- **Acceptance Criteria:**
  - Generated rules are syntactically valid
  - Rules cover all detected collections/paths
  - TODOs indicate where human review needed

### 3.4 Index Generation
- [x] Define `FirestoreIndex` interface:
  - collection: string, fields: IndexField[], queryScope: string
- [x] Implement `generateIndexes(requirements): FirestoreIndex[]` method
- [x] Detect compound queries that require indexes
- [x] Generate index definitions for detected queries
- [x] Format as firestore.indexes.json content
- **Acceptance Criteria:**
  - Detects queries needing indexes
  - Generates valid index definitions

### 3.5 TypeScript Type Generation
- [x] Create `src/backend/spec/TypeDefinitionGenerator.ts`
- [x] Implement `generateTypeDefinitions(schema): string` method
- [x] Generate TypeScript interface for each collection
- [x] Include field types (inferred or `any`)
- [x] Generate utility types (DocumentReference, CollectionReference)
- [x] Format with proper indentation and comments
- **Acceptance Criteria:**
  - Generated TypeScript is syntactically valid
  - Interfaces match Firestore schema
  - Output is well-formatted

### 3.6 Spec Compilation
- [x] Implement `generateFullSpec(requirements): FirebaseSpec` method in FirebaseSpecGenerator
- [x] Orchestrate all generators
- [x] Compile complete Firebase specification
- [x] Include metadata (generated date, source info)
- **Acceptance Criteria:**
  - Complete spec is generated from requirements
  - All components are included

---

## Section 4: Gemini Handoff System

Formats specs for Firebase Studio's Gemini assistant.

### 4.1 Prompt Formatter Base
- [x] Create `src/backend/handoff/PromptFormatter.ts`
- [x] Define `HandoffPrompt` interface:
  - systemContext: string
  - taskDescription: string
  - specifications: string
  - constraints: string[]
  - expectedOutputs: string[]
- [x] Implement `PromptFormatter` class
- **Acceptance Criteria:**
  - Prompt structure supports effective Gemini interaction

### 4.2 Handoff Prompt Generation
- [x] Implement `formatHandoffPrompt(spec: FirebaseSpec): HandoffPrompt` method
- [x] Create system context explaining Tideate IDE and the spec
- [x] Format Firestore schema as clear documentation
- [x] Include security rules with explanation
- [x] Include indexes with explanation
- [x] Specify constraints (use emulators, follow schema exactly)
- [x] Specify expected outputs (working backend, confirmation)
- **Acceptance Criteria:**
  - Prompt is clear and comprehensive
  - Gemini can understand and execute the spec

### 4.3 Gemini Handoff Execution
- [x] Create `src/backend/handoff/GeminiHandoff.ts`
- [x] Implement `GeminiHandoff` class
- [x] Implement `prepareHandoff(spec): HandoffPrompt` method
- [x] Implement `copyToClipboard(prompt): Promise<void>` method
- [x] Implement `openGeminiPanel(): Promise<void>` method (VS Code command)
- **Acceptance Criteria:**
  - Handoff prompt can be copied to clipboard
  - Gemini panel can be opened programmatically

### 4.4 Handoff UI Flow
- [x] Implement `executeHandoff(): Promise<void>` method orchestrating full flow:
  1. Generate current requirements
  2. Generate Firebase spec
  3. Format handoff prompt
  4. Copy to clipboard
  5. Open Gemini panel
  6. Show notification with instructions
- [x] Handle errors at each step gracefully
- **Acceptance Criteria:**
  - One-click handoff experience
  - User knows what to do next
  - Errors don't leave user stuck

### 4.5 Handoff History
- [ ] Track handoff attempts with timestamp and spec snapshot
- [ ] Implement `getHandoffHistory(): HandoffRecord[]` method
- [ ] Store in `.tideate/handoff-history.json`
- [ ] Enable comparing current spec to last handoff
- **Acceptance Criteria:**
  - Handoff history is preserved
  - Can see what was handed off previously

---

## Section 5: Provisioning Verification

Verifies backend was provisioned correctly and enables rollback.

### 5.1 Provisioning Verifier Base
- [x] Create `src/backend/verification/ProvisioningVerifier.ts`
- [x] Define `ProvisioningResult` interface:
  - success: boolean, checks: ProvisioningCheck[], errors: string[], warnings: string[]
- [x] Define `ProvisioningCheck` interface:
  - name: string, passed: boolean, details: string
- [x] Implement `ProvisioningVerifier` class
- **Acceptance Criteria:**
  - Verification structure supports detailed reporting

### 5.2 Security Rules Verification
- [x] Create `src/backend/verification/SecurityRulesTester.ts`
- [x] Implement `testFirestoreRules(spec): Promise<RulesTestResult>` method
- [ ] Use Firebase Emulator to test rules
- [ ] Test read/write permissions for each collection
- [ ] Report any permission mismatches
- **Acceptance Criteria:**
  - Tests rules against emulator
  - Detects permission issues

### 5.3 Schema Verification
- [x] Create `src/backend/verification/SpecComparator.ts`
- [x] Implement `compareSpec(expected, actual): SpecDiff` method
- [x] Compare expected collections to actual Firestore collections
- [x] Detect missing collections
- [x] Detect extra (unexpected) collections
- [x] Compare field structures where possible
- **Acceptance Criteria:**
  - Detects missing collections
  - Detects schema mismatches

### 5.4 Full Provisioning Verification
- [ ] Implement `verifyProvisioning(spec): Promise<ProvisioningResult>` method in ProvisioningVerifier
- [ ] Run security rules tests
- [ ] Run schema comparison
- [ ] Check auth providers are configured
- [ ] Check storage rules are deployed
- [ ] Aggregate all results
- **Acceptance Criteria:**
  - Comprehensive verification of provisioning
  - Clear pass/fail with details

### 5.5 Rollback System
- [x] Create `src/backend/verification/RollbackSystem.ts`
- [x] Implement `createBackendSnapshot(): Promise<string>` method
- [x] Capture current Firestore rules, indexes, storage rules
- [x] Implement `rollback(snapshotId): Promise<void>` method
- [x] Restore previous configuration
- [x] Integrate with SnapshotManager for unified rollback
- **Acceptance Criteria:**
  - Can snapshot backend configuration
  - Can restore previous configuration
  - Rollback doesn't affect data (only rules/config)

---

## Section 6: UI & Commands

User interface for backend intelligence features.

### 6.1 Backend Tracker Panel
- [ ] Create webview panel showing current backend requirements
- [ ] Display detected collections with fields
- [ ] Display detected auth providers
- [ ] Display detected storage paths
- [ ] Display detected cloud functions
- [ ] Update in real-time as code changes
- **Acceptance Criteria:**
  - Panel shows accurate current requirements
  - Updates reflect code changes

### 6.2 Commands
- [ ] Register command `tideate.scanBackendRequirements` - manual full scan
- [ ] Register command `tideate.generateFirebaseSpec` - generate and show spec
- [ ] Register command `tideate.handoffToGemini` - execute full handoff flow
- [ ] Register command `tideate.verifyProvisioning` - run verification
- [ ] Register command `tideate.showBackendPanel` - open tracker panel
- **Acceptance Criteria:**
  - All commands appear in Command Palette
  - Commands execute correctly

### 6.3 Notifications & Guidance
- [ ] Show notification when new backend requirements detected
- [ ] Show notification when spec is ready for handoff
- [ ] Show notification with verification results
- [ ] Provide actionable guidance in notifications (buttons to next steps)
- **Acceptance Criteria:**
  - Notifications are informative, not spammy
  - Users know what action to take

---

## Exit Criteria

Before considering Tideate IDE feature-complete, verify:

- [x] **CodeAnalyzer** detects Firestore, Auth, Storage, and Functions usage in code
- [x] **RequirementsAccumulator** aggregates requirements from entire codebase
- [x] **FirebaseSpecGenerator** produces valid Firestore schema, security rules, and indexes
- [x] **TypeDefinitionGenerator** produces valid TypeScript interfaces
- [x] **GeminiHandoff** formats comprehensive prompt and copies to clipboard
- [x] **ProvisioningVerifier** validates backend matches spec
- [x] **RollbackSystem** can restore previous backend configuration
- [ ] Backend Tracker Panel shows real-time requirements
- [ ] End-to-end test: Write Firebase code → Detected → Spec generated → Handoff → Verify
- [ ] No TypeScript errors in backend intelligence code

---

## Notes for Builder

**Key Files to Create:**
```
src/backend/tracker/
├── ASTParser.ts
├── CodeAnalyzer.ts
└── RequirementsAccumulator.ts

src/backend/spec/
├── FirebaseSpecGenerator.ts
├── SecurityRulesGenerator.ts
└── TypeDefinitionGenerator.ts

src/backend/handoff/
├── PromptFormatter.ts
└── GeminiHandoff.ts

src/backend/verification/
├── ProvisioningVerifier.ts
├── SecurityRulesTester.ts
├── SpecComparator.ts
└── RollbackSystem.ts
```

**AST Parsing Considerations:**
- TypeScript compiler API is complex but powerful
- Consider using `ts-morph` library for easier AST manipulation
- Handle JSX/TSX syntax (React components)
- Handle both CommonJS and ES modules

**Firebase SDK Versions:**
- Firebase v9 (modular) is the current standard
- Some projects may still use v8 (namespaced) syntax
- Support both where feasible, prioritize v9

**Security Rules Generation:**
- Default to restrictive rules (authenticated only)
- Never generate rules that allow unauthenticated write
- Include comments explaining each rule
- Mark custom logic areas with TODOs

**Testing Strategy:**
- Create sample projects with known Firebase usage
- Test code analyzer against samples
- Test spec generator output validity
- Test handoff prompt clarity with manual Gemini testing

---

*This checklist completes the Tideate IDE feature set with intelligent backend automation.*
