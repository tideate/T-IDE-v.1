import { PreviewIntegration } from '../../firebase/PreviewIntegration';
import * as vscode from 'vscode'; // Added because original TDD implied it might use vscode types indirectly or eventually

export interface RuntimeError {
    type: 'exception' | 'rejection' | 'console-error' | 'network';
    message: string;
    stack?: string;
    location?: string;
    timestamp: Date;
    isFatal: boolean;
    suggestedFix?: string;
}

export class RuntimeErrorDetector {
    private errors: RuntimeError[] = [];
    private isMonitoring = false;

    constructor(private previewIntegration: PreviewIntegration) {
    }

    /**
     * Start monitoring the preview for errors
     */
    async startMonitoring(): Promise<void> {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.errors = [];

        // In real implementation this would hook into ConsoleMonitor
        // For now this is a placeholder as per TDD which depends on ConsoleMonitor
        // which we are about to create.
        // We will update this file after creating ConsoleMonitor to properly link them.
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

    // Public method to add error (called by ConsoleMonitor)
    public addError(error: RuntimeError) {
        this.errors.push(error);
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
