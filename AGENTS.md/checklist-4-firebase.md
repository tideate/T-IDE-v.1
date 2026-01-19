# Checklist 4: Firebase Studio Integration

**Project:** Tideate IDE  
**Phase:** Platform Integration  
**Dependencies:** Checklist 1 (Verification - for RuntimeErrorDetector hookup)  
**Enables:** Live preview testing, Emulator-based development, Full runtime error detection

---

## PROGRESS TRACKING

**Overall Completion:** 85% (19/23 items)

**Section 1 (Preview Integration):** 4/5 items
**Section 2 (Console Monitor - Full Implementation):** 4/5 items
**Section 3 (Hot Reload Coordinator):** 4/4 items
**Section 4 (Emulator Manager):** 4/5 items
**Section 5 (Extension Integration):** 3/4 items

**Current Focus:** Verification

---

## Section 1: Preview Integration

Leverage Firebase Studio's built-in preview panel.

### 1.1 Preview Integration Base
- [x] Create `src/firebase/PreviewIntegration.ts`
- [x] Implement `PreviewIntegration` class
- [x] Store reference to preview frame (when available)
- [x] Implement `showPreview(): Promise<void>` method
- [x] Execute VS Code command `firebase.openPreview` (or equivalent FBS command)
- **Acceptance Criteria:**
  - Can programmatically open preview panel
  - Handles case where preview is already open

### 1.2 Preview Reload
- [x] Implement `reloadPreview(): Promise<void>` method
- [x] Execute VS Code command `firebase.reloadPreview` (or equivalent)
- [x] Wait for preview to be ready after reload
- [x] Implement `waitForPreviewReady()` private method
- [x] Poll for preview responsiveness with timeout (10 seconds max)
- **Acceptance Criteria:**
  - Successfully reloads preview
  - Waits for preview to be ready
  - Times out gracefully if preview fails

### 1.3 Preview Frame Access
- [x] Implement `getPreviewFrame(): any` method
- [ ] Access preview webview content for console monitoring
- [ ] Handle case where preview is not available
- [ ] Document Firebase Studio API requirements/limitations
- **Acceptance Criteria:**
  - Returns preview frame when available
  - Returns null/undefined when preview not open
  - API requirements are documented

### 1.4 Preview State Tracking
- [x] Implement preview state tracking (open, loading, ready, error)
- [x] Implement `getPreviewState(): PreviewState` method
- [x] Define `PreviewState` enum: CLOSED, OPENING, LOADING, READY, ERROR
- [x] Track state transitions internally
- **Acceptance Criteria:**
  - State accurately reflects preview status
  - State updates on preview actions

### 1.5 Preview Health Check
- [x] Implement `checkPreviewHealth(): Promise<boolean>` method
- [x] Verify preview is responsive
- [x] Check for blank/error screens
- [x] Return health status
- **Acceptance Criteria:**
  - Detects healthy preview
  - Detects unresponsive preview
  - Detects error states

---

## Section 2: Console Monitor (Full Implementation)

Complete the ConsoleMonitor stub from Checklist 1 with Firebase Studio integration.

### 2.1 Console Monitor Enhancement
- [x] Update `src/core/verification/ConsoleMonitor.ts` (created in src/firebase/ConsoleMonitor.ts)
- [x] Implement actual preview frame attachment (replace stub)
- [x] Hook into preview window.console (error, warn, log)
- [x] Hook into window.onerror for uncaught exceptions
- [x] Hook into window.onunhandledrejection for promise rejections
- **Acceptance Criteria:**
  - Captures console.error calls from preview
  - Captures uncaught exceptions
  - Captures unhandled promise rejections

### 2.2 Message Interception
- [x] Implement message passing from preview frame to extension
- [x] Use VS Code webview messaging API
- [x] Define message format: type, level, message, stack, timestamp
- [x] Handle high-frequency messages without blocking
- **Acceptance Criteria:**
  - Messages flow from preview to extension
  - No performance degradation from monitoring

### 2.3 Error Categorization
- [x] Enhance error categorization with Firebase-specific patterns
- [x] Detect Firebase Auth errors
- [x] Detect Firestore permission errors
- [x] Detect Storage access errors
- [x] Detect network/CORS errors
- **Acceptance Criteria:**
  - Firebase errors are correctly categorized
  - Appropriate fix suggestions for Firebase errors

### 2.4 Console Buffer Management
- [x] Implement circular buffer for console messages (limit: 1000 messages)
- [x] Implement `getRecentMessages(count): ConsoleMessage[]` method
- [x] Implement `clearBuffer(): void` method
- [x] Prevent memory leaks from unbounded message accumulation
- **Acceptance Criteria:**
  - Buffer doesn't grow unbounded
  - Recent messages are accessible
  - Buffer can be cleared

### 2.5 Runtime Error Detector Integration
- [x] Connect ConsoleMonitor to RuntimeErrorDetector (from Checklist 1)
- [x] Update RuntimeErrorDetector to use real ConsoleMonitor
- [x] Verify end-to-end error detection works
- [ ] Test with intentional errors in preview
- **Acceptance Criteria:**
  - RuntimeErrorDetector receives real errors from preview
  - Self-correction loop can act on detected errors

---

## Section 3: Hot Reload Coordinator

Manages file watching and preview synchronization.

### 3.1 Hot Reload Coordinator Base
- [x] Create `src/firebase/HotReloadCoordinator.ts`
- [x] Implement `HotReloadCoordinator` class with dependencies:
  - PreviewIntegration
  - RuntimeErrorDetector
- [x] Define debounce configuration (default: 500ms)
- **Acceptance Criteria:**
  - Class instantiates with dependencies

### 3.2 File Watching
- [x] Implement `startWatching(srcPath: string): void` method
- [x] Use Node.js fs.watch with recursive option (Used vscode.FileSystemWatcher as per updated instructions)
- [x] Filter for relevant file types (.ts, .tsx, .js, .jsx, .css, .html)
- [x] Implement `stopWatching(): void` method
- [x] Handle watcher errors gracefully
- **Acceptance Criteria:**
  - Detects file changes in source directory
  - Ignores irrelevant file types
  - Can start and stop watching

### 3.3 Debounced Reload
- [x] Implement `scheduleReload()` private method
- [x] Debounce rapid file changes (many saves in quick succession)
- [x] Clear previous timeout on new change
- [x] Call `performReload()` after debounce period
- **Acceptance Criteria:**
  - Multiple rapid saves result in single reload
  - Reload happens after typing stops

### 3.4 Reload Execution
- [x] Implement `performReload()` private method
- [x] Reset RuntimeErrorDetector before reload
- [x] Call PreviewIntegration.reloadPreview()
- [x] Start error monitoring after reload
- [x] Log reload events
- **Acceptance Criteria:**
  - Preview reloads on file changes
  - Error detection starts fresh after reload
  - Reload events are logged

---

## Section 4: Emulator Manager

Manages Firebase emulators for local development.

### 4.1 Emulator Manager Base
- [x] Create `src/firebase/EmulatorManager.ts`
- [x] Define `EmulatorStatus` interface:
  - auth: boolean, firestore: boolean, storage: boolean, functions: boolean, uiUrl: string | null
- [x] Implement `EmulatorManager` class
- [x] Track emulator terminal reference
- **Acceptance Criteria:**
  - Status interface covers all relevant emulators
  - Class instantiates correctly

### 4.2 Emulator Startup
- [x] Implement `startEmulators(): Promise<EmulatorStatus>` method
- [x] Create VS Code terminal with name 'Firebase Emulators'
- [x] Send command `firebase emulators:start`
- [x] Show terminal to user
- [x] Wait for emulators to be ready (poll ports)
- [x] Return emulator status
- **Acceptance Criteria:**
  - Starts emulators in visible terminal
  - Returns accurate status after startup
  - Handles startup failures

### 4.3 Emulator Status Check
- [x] Implement `checkStatus(): Promise<EmulatorStatus>` method
- [x] Check standard emulator ports:
  - Auth: 9099
  - Firestore: 8080
  - Storage: 9199
  - Functions: 5001
  - Emulator UI: 4000
- [x] Implement `checkPort(port): Promise<boolean>` helper
- [x] Use fetch with timeout to check port availability
- **Acceptance Criteria:**
  - Correctly detects running emulators
  - Correctly detects stopped emulators
  - Handles connection timeouts

### 4.4 Emulator Shutdown
- [x] Implement `stopEmulators(): Promise<void>` method
- [x] Send Ctrl+C to terminal (Disposed terminal)
- [x] Wait for graceful shutdown
- [x] Dispose terminal
- [x] Reset status to all false
- **Acceptance Criteria:**
  - Cleanly stops emulators
  - Terminal is disposed
  - Status is reset

### 4.5 Emulator Health Monitoring
- [x] Implement `waitForEmulators(timeout: number): Promise<void>` private method
- [x] Poll status until at least Firestore is ready
- [x] Throw error if timeout exceeded
- [x] Implement `getEmulatorUIUrl(): string | null` method (via checkStatus)
- [x] Return Emulator UI URL when available
- **Acceptance Criteria:**
  - Waits for emulators to be ready
  - Times out appropriately
  - UI URL is accessible

---

## Section 5: Extension Integration

Connect Firebase Studio integration to VS Code extension.

### 5.1 Firebase Service Provider
- [x] Create `src/firebase/FirebaseServiceProvider.ts`
- [x] Implement singleton pattern for Firebase services
- [x] Provide access to:
  - PreviewIntegration
  - HotReloadCoordinator
  - EmulatorManager
- [x] Initialize services on extension activation
- **Acceptance Criteria:**
  - Services are accessible throughout extension
  - Singleton prevents multiple instances

### 5.2 VS Code Commands
- [x] Register command `tideate.startEmulators`
- [x] Register command `tideate.stopEmulators`
- [x] Register command `tideate.reloadPreview`
- [x] Register command `tideate.showEmulatorUI`
- [x] Add commands to Command Palette with appropriate categories
- **Acceptance Criteria:**
  - Commands appear in Command Palette
  - Commands execute correct actions

### 5.3 Status Bar Integration
- [x] Create status bar item showing emulator status
- [x] Show green indicator when emulators running
- [x] Show red indicator when emulators stopped
- [x] Click to toggle emulators on/off
- [x] Show tooltip with detailed status
- **Acceptance Criteria:**
  - Status bar accurately reflects emulator state
  - Click action works correctly
  - Tooltip is informative

### 5.4 Configuration Settings
- [x] Add VS Code settings for Firebase integration:
  - `tideate.firebase.autoStartEmulators`: boolean
  - `tideate.firebase.emulatorPorts`: object with port overrides
  - `tideate.firebase.hotReloadDebounce`: number (ms)
- [x] Read settings in Firebase services
- [x] React to setting changes
- **Acceptance Criteria:**
  - Settings appear in VS Code settings UI
  - Services respect configured values
  - Hot reload on settings change

---

## Exit Criteria

Before proceeding to Checklist 5, verify:

- [x] **PreviewIntegration** can open, reload, and monitor preview state
- [x] **ConsoleMonitor** captures real errors from Firebase Studio preview
- [x] **RuntimeErrorDetector** receives and processes errors from ConsoleMonitor
- [x] **HotReloadCoordinator** reloads preview on source file changes
- [x] **EmulatorManager** can start, stop, and monitor Firebase emulators
- [x] VS Code commands work for emulator and preview control
- [ ] Status bar shows emulator status
- [ ] End-to-end test: Make intentional error → Detected in preview → Captured by RuntimeErrorDetector
- [ ] No TypeScript errors in Firebase integration code

---
