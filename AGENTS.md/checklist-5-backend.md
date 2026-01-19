# Checklist 5: Backend Intelligence Layer

**Project:** Tideate IDE  
**Phase:** Advanced Features  
**Dependencies:** Checklist 2 (Workflow Engine), Checklist 4 (Firebase Integration)  
**Enables:** Automatic backend spec generation, One-click Gemini handoff, Full-stack development automation

---

## PROGRESS TRACKING

**Overall Completion:** 0% (0/30 items)

**Section 1 (Code Analyzer):** 0/6 items  
**Section 2 (Requirements Accumulator):** 0/5 items  
**Section 3 (Firebase Spec Generator):** 0/6 items  
**Section 4 (Gemini Handoff System):** 0/5 items  
**Section 5 (Provisioning Verification):** 0/5 items  
**Section 6 (UI & Commands):** 0/3 items  

**Current Focus:** Section 1 - Code Analyzer

---

## Section 1: Code Analyzer

Silently analyzes frontend code to detect Firebase service usage.

### 1.1 AST Parser Setup
- [ ] Create `src/backend/tracker/ASTParser.ts`
- [ ] Install/configure TypeScript compiler API for AST parsing
- [ ] Implement `parse(code: string, filePath: string): AST` method
- [ ] Handle TypeScript and JavaScript files
- [ ] Handle parsing errors gracefully (return partial AST or null)
- **Acceptance Criteria:**
  - Successfully parses TypeScript/JavaScript files
  - Returns usable AST for analysis
  - Doesn't crash on malformed code

### 1.2 Code Analyzer Base
- [ ] Create `src/backend/tracker/CodeAnalyzer.ts`
- [ ] Define `AnalysisResult` interface:
  - firestoreCalls: FirestoreCall[]
  - authCalls: AuthCall[]
  - storageCalls: StorageCall[]
  - functionCalls: FunctionCall[]
- [ ] Implement `CodeAnalyzer` class with ASTParser dependency
- [ ] Implement `analyzeFile(filePath): AnalysisResult` method
- [ ] Implement `analyzeCode(code, filePath): AnalysisResult` method
- **Acceptance Criteria:**
  - Can analyze individual files
  - Returns structured analysis results

### 1.3 Firestore Call Detection
- [ ] Define `FirestoreCall` interface:
  - collection: string, operation: string ('get' | 'set' | 'update' | 'delete' | 'query'), fields: string[], location: string
- [ ] Implement `detectFirestoreCalls(ast): FirestoreCall[]` private method
- [ ] Detect patterns:
  - `collection('name')` / `doc('collection/id')`
  - `.get()`, `.set()`, `.update()`, `.delete()`
  - `.where()`, `.orderBy()`, `.limit()` (query operations)
  - `addDoc()`, `setDoc()`, `updateDoc()`, `deleteDoc()`
- [ ] Extract collection names from call arguments
- [ ] Extract field names from data objects where possible
- **Acceptance Criteria:**
  - Detects Firestore v9 modular syntax
  - Detects Firestore v8 chained syntax
  - Extracts collection and field information

### 1.4 Auth Call Detection
- [ ] Define `AuthCall` interface:
  - provider: string, operation: string, location: string
- [ ] Implement `detectAuthCalls(ast): AuthCall[]` private method
- [ ] Detect patterns:
  - `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`
  - `signInWithPopup`, `signInWithRedirect` (OAuth providers)
  - `signOut`, `onAuthStateChanged`
  - `GoogleAuthProvider`, `FacebookAuthProvider`, etc.
- [ ] Extract provider types used
- **Acceptance Criteria:**
  - Detects all common auth patterns
  - Identifies OAuth providers in use

### 1.5 Storage Call Detection
- [ ] Define `StorageCall` interface:
  - path: string, operation: string ('upload' | 'download' | 'delete' | 'list'), location: string
- [ ] Implement `detectStorageCalls(ast): StorageCall[]` private method
- [ ] Detect patterns:
  - `ref(storage, 'path')`, `storageRef`
  - `uploadBytes`, `uploadString`, `uploadBytesResumable`
  - `getDownloadURL`, `getBlob`, `getBytes`
  - `deleteObject`, `listAll`, `list`
- [ ] Extract storage paths from arguments
- **Acceptance Criteria:**
  - Detects Storage v9 modular syntax
  - Extracts storage path patterns

### 1.6 Cloud Function Call Detection
- [ ] Define `FunctionCall` interface:
  - functionName: string, region: string (optional), location: string
- [ ] Implement `detectFunctionCalls(ast): FunctionCall[]` private method
- [ ] Detect patterns:
  - `httpsCallable(functions, 'functionName')`
  - `getFunctions()`, `connectFunctionsEmulator()`
- [ ] Extract function names
- **Acceptance Criteria:**
  - Detects callable function usage
  - Extracts function names

---

## Section 2: Requirements Accumulator

Aggregates detected requirements across the codebase.

### 2.1 Requirements Accumulator Base
- [ ] Create `src/backend/tracker/RequirementsAccumulator.ts`
- [ ] Define `BackendRequirements` interface:
  - collections: CollectionRequirement[]
  - authProviders: string[]
  - storagePaths: StoragePathRequirement[]
  - functions: FunctionRequirement[]
  - lastUpdated: Date
- [ ] Define sub-interfaces for each requirement type with fields, operations, sources
- [ ] Implement `RequirementsAccumulator` class
- **Acceptance Criteria:**
  - Comprehensive requirement structure defined
  - Class instantiates correctly

### 2.2 Requirement Aggregation
- [ ] Implement `addAnalysisResult(result: AnalysisResult, sourceFile: string): void` method
- [ ] Merge Firestore calls into collections (combine same collection from different files)
- [ ] Aggregate fields discovered for each collection
- [ ] Aggregate operations (read, write, query) per collection
- [ ] Track source files for each requirement (for traceability)
- **Acceptance Criteria:**
  - Multiple files analyzing same collection are merged
  - Fields are accumulated across files
  - Source tracking enables debugging

### 2.3 Full Codebase Scan
- [ ] Implement `scanCodebase(srcPath: string): Promise<BackendRequirements>` method
- [ ] Recursively find all .ts, .tsx, .js, .jsx files
- [ ] Analyze each file with CodeAnalyzer
- [ ] Accumulate all results
- [ ] Update lastUpdated timestamp
- **Acceptance Criteria:**
  - Scans entire source directory
  - Handles large codebases efficiently
  - Returns complete requirements

### 2.4 Incremental Updates
- [ ] Implement `updateFile(filePath: string): void` method for single file re-analysis
- [ ] Remove old requirements from that file
- [ ] Add new requirements from updated analysis
- [ ] Integrate with HotReloadCoordinator for automatic updates
- **Acceptance Criteria:**
  - Single file changes update requirements efficiently
  - Old data from changed file is replaced

### 2.5 Requirements Persistence
- [ ] Implement `save(): Promise<void>` method
- [ ] Save requirements to `.tideate/backend-requirements.json`
- [ ] Implement `load(): Promise<BackendRequirements>` method
- [ ] Load requirements on extension activation
- **Acceptance Criteria:**
  - Requirements persist across sessions
  - Load/save cycle preserves all data

---

## Section 3: Firebase Spec Generator

Transforms requirements into Firebase configuration specs.

### 3.1 Spec Generator Base
- [ ] Create `src/backend/spec/FirebaseSpecGenerator.ts`
- [ ] Define `FirebaseSpec` interface:
  - firestoreSchema: FirestoreSchema
  - securityRules: string (firestore.rules content)
  - storageRules: string (storage.rules content)
  - indexes: FirestoreIndex[]
  - typeDefinitions: string (TypeScript interfaces)
- [ ] Implement `FirebaseSpecGenerator` class
- **Acceptance Criteria:**
  - Spec structure covers all Firebase configuration needs

### 3.2 Firestore Schema Generation
- [ ] Define `FirestoreSchema` interface:
  - collections: CollectionSchema[] (name, fields with types, subcollections)
- [ ] Implement `generateFirestoreSchema(requirements): FirestoreSchema` method
- [ ] Infer field types from usage patterns where possible
- [ ] Mark unknown types as `any` with TODO comment
- [ ] Handle nested subcollections
- **Acceptance Criteria:**
  - Generates schema for all detected collections
  - Infers types where possible
  - Marks ambiguous types clearly

### 3.3 Security Rules Generation
- [ ] Create `src/backend/spec/SecurityRulesGenerator.ts`
- [ ] Implement `generateFirestoreRules(schema, requirements): string` method
- [ ] Generate rules structure matching schema collections
- [ ] Default to authenticated read/write (safe starting point)
- [ ] Add TODO comments for rules that need customization
- [ ] Implement `generateStorageRules(requirements): string` method
- [ ] Generate storage rules based on detected paths
- **Acceptance Criteria:**
  - Generated rules are syntactically valid
  - Rules cover all detected collections/paths
  - TODOs indicate where human review needed

### 3.4 Index Generation
- [ ] Define `FirestoreIndex` interface:
  - collection: string, fields: IndexField[], queryScope: string
- [ ] Implement `generateIndexes(requirements): FirestoreIndex[]` method
- [ ] Detect compound queries that require indexes
- [ ] Generate index definitions for detected queries
- [ ] Format as firestore.indexes.json content
- **Acceptance Criteria:**
  - Detects queries needing indexes
  - Generates valid index definitions

### 3.5 TypeScript Type Generation
- [ ] Create `src/backend/spec/TypeDefinitionGenerator.ts`
- [ ] Implement `generateTypeDefinitions(schema): string` method
- [ ] Generate TypeScript interface for each collection
- [ ] Include field types (inferred or `any`)
- [ ] Generate utility types (DocumentReference, CollectionReference)
- [ ] Format with proper indentation and comments
- **Acceptance Criteria:**
  - Generated TypeScript is syntactically valid
  - Interfaces match Firestore schema
  - Output is well-formatted

### 3.6 Spec Compilation
- [ ] Implement `generateFullSpec(requirements): FirebaseSpec` method in FirebaseSpecGenerator
- [ ] Orchestrate all generators
- [ ] Compile complete Firebase specification
- [ ] Include metadata (generated date, source info)
- **Acceptance Criteria:**
  - Complete spec is generated from requirements
  - All components are included

---

## Section 4: Gemini Handoff System

Formats specs for Firebase Studio's Gemini assistant.

### 4.1 Prompt Formatter Base
- [ ] Create `src/backend/handoff/PromptFormatter.ts`
- [ ] Define `HandoffPrompt` interface:
  - systemContext: string
  - taskDescription: string
  - specifications: string
  - constraints: string[]
  - expectedOutputs: string[]
- [ ] Implement `PromptFormatter` class
- **Acceptance Criteria:**
  - Prompt structure supports effective Gemini interaction

### 4.2 Handoff Prompt Generation
- [ ] Implement `formatHandoffPrompt(spec: FirebaseSpec): HandoffPrompt` method
- [ ] Create system context explaining Tideate IDE and the spec
- [ ] Format Firestore schema as clear documentation
- [ ] Include security rules with explanation
- [ ] Include indexes with explanation
- [ ] Specify constraints (use emulators, follow schema exactly)
- [ ] Specify expected outputs (working backend, confirmation)
- **Acceptance Criteria:**
  - Prompt is clear and comprehensive
  - Gemini can understand and execute the spec

### 4.3 Gemini Handoff Execution
- [ ] Create `src/backend/handoff/GeminiHandoff.ts`
- [ ] Implement `GeminiHandoff` class
- [ ] Implement `prepareHandoff(spec): HandoffPrompt` method
- [ ] Implement `copyToClipboard(prompt): Promise<void>` method
- [ ] Implement `openGeminiPanel(): Promise<void>` method (VS Code command)
- **Acceptance Criteria:**
  - Handoff prompt can be copied to clipboard
  - Gemini panel can be opened programmatically

### 4.4 Handoff UI Flow
- [ ] Implement `executeHandoff(): Promise<void>` method orchestrating full flow:
  1. Generate current requirements
  2. Generate Firebase spec
  3. Format handoff prompt
  4. Copy to clipboard
  5. Open Gemini panel
  6. Show notification with instructions
- [ ] Handle errors at each step gracefully
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
- [ ] Create `src/backend/verification/ProvisioningVerifier.ts`
- [ ] Define `ProvisioningResult` interface:
  - success: boolean, checks: ProvisioningCheck[], errors: string[], warnings: string[]
- [ ] Define `ProvisioningCheck` interface:
  - name: string, passed: boolean, details: string
- [ ] Implement `ProvisioningVerifier` class
- **Acceptance Criteria:**
  - Verification structure supports detailed reporting

### 5.2 Security Rules Verification
- [ ] Create `src/backend/verification/SecurityRulesTester.ts`
- [ ] Implement `testFirestoreRules(spec): Promise<RulesTestResult>` method
- [ ] Use Firebase Emulator to test rules
- [ ] Test read/write permissions for each collection
- [ ] Report any permission mismatches
- **Acceptance Criteria:**
  - Tests rules against emulator
  - Detects permission issues

### 5.3 Schema Verification
- [ ] Create `src/backend/verification/SpecComparator.ts`
- [ ] Implement `compareSpec(expected, actual): SpecDiff` method
- [ ] Compare expected collections to actual Firestore collections
- [ ] Detect missing collections
- [ ] Detect extra (unexpected) collections
- [ ] Compare field structures where possible
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
- [ ] Create `src/backend/verification/RollbackSystem.ts`
- [ ] Implement `createBackendSnapshot(): Promise<string>` method
- [ ] Capture current Firestore rules, indexes, storage rules
- [ ] Implement `rollback(snapshotId): Promise<void>` method
- [ ] Restore previous configuration
- [ ] Integrate with SnapshotManager for unified rollback
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

- [ ] **CodeAnalyzer** detects Firestore, Auth, Storage, and Functions usage in code
- [ ] **RequirementsAccumulator** aggregates requirements from entire codebase
- [ ] **FirebaseSpecGenerator** produces valid Firestore schema, security rules, and indexes
- [ ] **TypeDefinitionGenerator** produces valid TypeScript interfaces
- [ ] **GeminiHandoff** formats comprehensive prompt and copies to clipboard
- [ ] **ProvisioningVerifier** validates backend matches spec
- [ ] **RollbackSystem** can restore previous backend configuration
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
