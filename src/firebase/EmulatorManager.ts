import * as vscode from 'vscode';
import * as child_process from 'child_process';

export interface EmulatorStatus {
    auth: boolean;
    firestore: boolean;
    storage: boolean;
    functions: boolean;
    uiUrl: string | null;
}

export class EmulatorManager {
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
        // Check if firebase CLI is installed
        if (!await this.isFirebaseInstalled()) {
            const result = await vscode.window.showErrorMessage(
                'Firebase CLI is not installed or not in PATH.',
                'Install Now',
                'Cancel'
            );

            if (result === 'Install Now') {
                vscode.env.openExternal(vscode.Uri.parse('https://firebase.google.com/docs/cli'));
            }

            throw new Error('Firebase CLI is not installed or not in PATH.');
        }

        // Check if logged in (optional but good to check)
        // For emulators, login might not be strictly required if using demo project,
        // but for full integration usually it is.
        // We will proceed but warn if not logged in could be an enhancement.

        // Create or reuse terminal
        if (!this.terminal || this.terminal.exitStatus !== undefined) {
             this.terminal = vscode.window.createTerminal({
                name: 'Firebase Emulators',
                cwd: vscode.workspace.rootPath
            });
        }


        // Start emulators
        this.terminal.sendText('firebase emulators:start');
        this.terminal.show();

        // Wait for emulators to be ready
        try {
            await this.waitForEmulators();
        } catch (error) {
            console.error('Failed to start emulators', error);
            // Even if it fails, we return the status which might be partially up or all down
        }

        return this.status;
    }

    /**
     * Stop Firebase emulators
     */
    async stopEmulators(): Promise<void> {
        if (this.terminal) {
            // Sending Ctrl+C to terminal is tricky programmatically in VS Code API if not supported directly.
            // A common workaround is disposing the terminal which kills the process shell.
            // However, that might leave child processes.
            // Ideally we should find the process and kill it, but VS Code terminal API doesn't give PID easily.
            // For now, we dispose the terminal.
            this.terminal.dispose();
            this.terminal = null;

            // Wait a bit for cleanup
            await this.sleep(1000);
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

            // Consider ready if at least Firestore is up (or whatever is the minimum)
            // TDD says: "Consider ready if at least Firestore is ready"
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);

            const response = await fetch(`http://localhost:${port}`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return true;
        } catch {
            return false;
        }
    }

    private async isFirebaseInstalled(): Promise<boolean> {
        return new Promise((resolve) => {
            child_process.exec('firebase --version', (error) => {
                resolve(!error);
            });
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public getStatus(): EmulatorStatus {
        return this.status;
    }
}
