# Checklist 4: Firebase Studio Integration

**Project:** Tideate IDE  
**Phase:** Platform Integration  
**Dependencies:** Checklist 1 (Verification - for RuntimeErrorDetector hookup)  
**Enables:** Live preview testing, Emulator-based development, Full runtime error detection

---

## PROGRESS TRACKING

**Overall Completion:** 0% (0/23 items)

**Section 1 (Preview Integration):** 0/5 items  
**Section 2 (Console Monitor - Full Implementation):** 0/5 items  
**Section 3 (Hot Reload Coordinator):** 0/4 items  
**Section 4 (Emulator Manager):** 0/5 items  
**Section 5 (Extension Integration):** 0/4 items  

**Current Focus:** Section 1 - Preview Integration

---

## Section 1: Preview Integration

Leverage Firebase Studio's built-in preview panel.

### 1.1 Preview Integration Base
- [ ] Create `src/firebase/PreviewIntegration.ts`
- [ ] Implement `PreviewIntegration` class
- [ ] Store reference to preview frame (when available)
- [ ] Implement `showPreview(): Promise<void>` method
- [ ] Execute VS Code command `firebase.openPreview` (or equivalent FBS command)
- **Acceptance Criteria:**
  - Can programmatically open preview panel
  - Handles case where preview is already open

### 1.2 Preview Reload
- [ ] Implement `reloadPreview(): Promise<void>` method
- [ ] Execute VS Code command `firebase.reloadPreview` (or equivalent)
- [ ] Wait for preview to be ready after reload
- [ ] Implement `waitForPreviewReady()` private method
- [ ] Poll for preview responsiveness with timeout (10 seconds max)
- **Acceptance Criteria:**
  - Successfully reloads preview
  - Waits for preview to be ready
  - Times out gracefully if preview fails

### 1.3 Preview Frame Access
- [ ] Implement `getPreviewFrame(): any` method
- [ ] Access preview webview content for console monitoring
- [ ] Handle case where preview is not available
- [ ] Document Firebase Studio API requirements/limitations
- **Acceptance Criteria:**
  - Returns preview frame when available
  - Returns null/undefined when preview not open
  - API requirements are documented

### 1.4 Preview State Tracking
- [ ] Implement preview state tracking (open, loading, ready, error)
- [ ] Implement `getPreviewState(): PreviewState` method
- [ ] Define `PreviewState` enum: CLOSED, OPENING, LOADING, READY, ERROR
- [ ] Track state transitions internally
- **Acceptance Criteria:**
  - State accurately reflects preview status
  - State updates on preview actions

### 1.5 Preview Health Check
- [ ] Implement `checkPreviewHealth(): Promise<boolean>` method
- [ ] Verify preview is responsive
- [ ] Check for blank/error screens
- [ ] Return health status
- **Acceptance Criteria:**
  - Detects healthy preview
  - Detects unresponsive preview
  - Detects error states

---

## Section 2: Console Monitor (Full Implementation)

Complete the ConsoleMonitor stub from Checklist 1 with Firebase Studio integration.

### 2.1 Console Monitor Enhancement
- [ ] Update `src/core/verification/ConsoleMonitor.ts` from Checklist 1
- [ ] Implement actual preview frame attachment (replace stub)
- [ ] Hook into preview window.console (error, warn, log)
- [ ] Hook into window.onerror for uncaught exceptions
- [ ] Hook into window.onunhandledrejection for promise rejections
- **Acceptance Criteria:**
  - Captures console.error calls from preview
  - Captures uncaught exceptions
  - Captures unhandled promise rejections

### 2.2 Message Interception
- [ ] Implement message passing from preview frame to extension
- [ ] Use VS Code webview messaging API
- [ ] Define message format: type, level, message, stack, timestamp
- [ ] Handle high-frequency messages without blocking
- **Acceptance Criteria:**
  - Messages flow from preview to extension
  - No performance degradation from monitoring

### 2.3 Error Categorization
- [ ] Enhance error categorization with Firebase-specific patterns
- [ ] Detect Firebase Auth errors
- [ ] Detect Firestore permission errors
- [ ] Detect Storage access errors
- [ ] Detect network/CORS errors
- **Acceptance Criteria:**
  - Firebase errors are correctly categorized
  - Appropriate fix suggestions for Firebase errors

### 2.4 Console Buffer Management
- [ ] Implement circular buffer for console messages (limit: 1000 messages)
- [ ] Implement `getRecentMessages(count): ConsoleMessage[]` method
- [ ] Implement `clearBuffer(): void` method
- [ ] Prevent memory leaks from unbounded message accumulation
- **Acceptance Criteria:**
  - Buffer doesn't grow unbounded
  - Recent messages are accessible
  - Buffer can be cleared

### 2.5 Runtime Error Detector Integration
- [ ] Connect ConsoleMonitor to RuntimeErrorDetector (from Checklist 1)
- [ ] Update RuntimeErrorDetector to use real ConsoleMonitor
- [ ] Verify end-to-end error detection works
- [ ] Test with intentional errors in preview
- **Acceptance Criteria:**
  - RuntimeErrorDetector receives real errors from preview
  - Self-correction loop can act on detected errors

---

## Section 3: Hot Reload Coordinator

Manages file watching and preview synchronization.

### 3.1 Hot Reload Coordinator Base
- [ ] Create `src/firebase/HotReloadCoordinator.ts`
- [ ] Implement `HotReloadCoordinator` class with dependencies:
  - PreviewIntegration
  - RuntimeErrorDetector
- [ ] Define debounce configuration (default: 500ms)
- **Acceptance Criteria:**
  - Class instantiates with dependencies

### 3.2 File Watching
- [ ] Implement `startWatching(srcPath: string): void` method
- [ ] Use Node.js fs.watch with recursive option
- [ ] Filter for relevant file types (.ts, .tsx, .js, .jsx, .css, .html)
- [ ] Implement `stopWatching(): void` method
- [ ] Handle watcher errors gracefully
- **Acceptance Criteria:**
  - Detects file changes in source directory
  - Ignores irrelevant file types
  - Can start and stop watching

### 3.3 Debounced Reload
- [ ] Implement `scheduleReload()` private method
- [ ] Debounce rapid file changes (many saves in quick succession)
- [ ] Clear previous timeout on new change
- [ ] Call `performReload()` after debounce period
- **Acceptance Criteria:**
  - Multiple rapid saves result in single reload
  - Reload happens after typing stops

### 3.4 Reload Execution
- [ ] Implement `performReload()` private method
- [ ] Reset RuntimeErrorDetector before reload
- [ ] Call PreviewIntegration.reloadPreview()
- [ ] Start error monitoring after reload
- [ ] Log reload events
- **Acceptance Criteria:**
  - Preview reloads on file changes
  - Error detection starts fresh after reload
  - Reload events are logged

---

## Section 4: Emulator Manager

Manages Firebase emulators for local development.

### 4.1 Emulator Manager Base
- [ ] Create `src/firebase/EmulatorManager.ts`
- [ ] Define `EmulatorStatus` interface:
  - auth: boolean, firestore: boolean, storage: boolean, functions: boolean, uiUrl: string | null
- [ ] Implement `EmulatorManager` class
- [ ] Track emulator terminal reference
- **Acceptance Criteria:**
  - Status interface covers all relevant emulators
  - Class instantiates correctly

### 4.2 Emulator Startup
- [ ] Implement `startEmulators(): Promise<EmulatorStatus>` method
- [ ] Create VS Code terminal with name 'Firebase Emulators'
- [ ] Send command `firebase emulators:start`
- [ ] Show terminal to user
- [ ] Wait for emulators to be ready (poll ports)
- [ ] Return emulator status
- **Acceptance Criteria:**
  - Starts emulators in visible terminal
  - Returns accurate status after startup
  - Handles startup failures

### 4.3 Emulator Status Check
- [ ] Implement `checkStatus(): Promise<EmulatorStatus>` method
- [ ] Check standard emulator ports:
  - Auth: 9099
  - Firestore: 8080
  - Storage: 9199
  - Functions: 5001
  - Emulator UI: 4000
- [ ] Implement `checkPort(port): Promise<boolean>` helper
- [ ] Use fetch with timeout to check port availability
- **Acceptance Criteria:**
  - Correctly detects running emulators
  - Correctly detects stopped emulators
  - Handles connection timeouts

### 4.4 Emulator Shutdown
- [ ] Implement `stopEmulators(): Promise<void>` method
- [ ] Send Ctrl+C to terminal
- [ ] Wait for graceful shutdown
- [ ] Dispose terminal
- [ ] Reset status to all false
- **Acceptance Criteria:**
  - Cleanly stops emulators
  - Terminal is disposed
  - Status is reset

### 4.5 Emulator Health Monitoring
- [ ] Implement `waitForEmulators(timeout: number): Promise<void>` private method
- [ ] Poll status until at least Firestore is ready
- [ ] Throw error if timeout exceeded
- [ ] Implement `getEmulatorUIUrl(): string | null` method
- [ ] Return Emulator UI URL when available
- **Acceptance Criteria:**
  - Waits for emulators to be ready
  - Times out appropriately
  - UI URL is accessible

---

## Section 5: Extension Integration

Connect Firebase Studio integration to VS Code extension.

### 5.1 Firebase Service Provider
- [ ] Create `src/firebase/FirebaseServiceProvider.ts`
- [ ] Implement singleton pattern for Firebase services
- [ ] Provide access to:
  - PreviewIntegration
  - HotReloadCoordinator
  - EmulatorManager
- [ ] Initialize services on extension activation
- **Acceptance Criteria:**
  - Services are accessible throughout extension
  - Singleton prevents multiple instances

### 5.2 VS Code Commands
- [ ] Register command `tideate.startEmulators`
- [ ] Register command `tideate.stopEmulators`
- [ ] Register command `tideate.reloadPreview`
- [ ] Register command `tideate.showEmulatorUI`
- [ ] Add commands to Command Palette with appropriate categories
- **Acceptance Criteria:**
  - Commands appear in Command Palette
  - Commands execute correct actions

### 5.3 Status Bar Integration
- [ ] Create status bar item showing emulator status
- [ ] Show green indicator when emulators running
- [ ] Show red indicator when emulators stopped
- [ ] Click to toggle emulators on/off
- [ ] Show tooltip with detailed status
- **Acceptance Criteria:**
  - Status bar accurately reflects emulator state
  - Click action works correctly
  - Tooltip is informative

### 5.4 Configuration Settings
- [ ] Add VS Code settings for Firebase integration:
  - `tideate.firebase.autoStartEmulators`: boolean
  - `tideate.firebase.emulatorPorts`: object with port overrides
  - `tideate.firebase.hotReloadDebounce`: number (ms)
- [ ] Read settings in Firebase services
- [ ] React to setting changes
- **Acceptance Criteria:**
  - Settings appear in VS Code settings UI
  - Services respect configured values
  - Hot reload on settings change

---

## Exit Criteria

Before proceeding to Checklist 5, verify:

- [ ] **PreviewIntegration** can open, reload, and monitor preview state
- [ ] **ConsoleMonitor** captures real errors from Firebase Studio preview
- [ ] **RuntimeErrorDetector** receives and processes errors from ConsoleMonitor
- [ ] **HotReloadCoordinator** reloads preview on source file changes
- [ ] **EmulatorManager** can start, stop, and monitor Firebase emulators
- [ ] VS Code commands work for emulator and preview control
- [ ] Status bar shows emulator status
- [ ] End-to-end test: Make intentional error → Detected in preview → Captured by RuntimeErrorDetector
- [ ] No TypeScript errors in Firebase integration code

---

## Notes for Builder

**Key Files to Create:**
```
src/firebase/
├── PreviewIntegration.ts
├── HotReloadCoordinator.ts
├── EmulatorManager.ts
└── FirebaseServiceProvider.ts
```

**Files to Update:**
```
src/core/verification/
├── ConsoleMonitor.ts (complete stub implementation)
└── RuntimeErrorDetector.ts (integrate with ConsoleMonitor)
```

**Firebase Studio Considerations:**
- Firebase Studio is built on VS Code, so standard extension APIs apply
- Preview panel may use proprietary FBS commands - document any discovered APIs
- Emulator integration should work identically to local Firebase development
- Test in actual Firebase Studio environment, not just VS Code

**Port Detection Notes:**
- Emulator ports are configurable in firebase.json
- Default ports may conflict with other services
- Consider reading firebase.json for actual port configuration

**Testing Strategy:**
- Test preview integration in Firebase Studio environment
- Test emulator management with actual Firebase project
- Test hot reload with rapid file saves
- Test error detection with intentional console.error and throw statements

---

*This checklist integrates Tideate IDE with Firebase Studio's development environment.*