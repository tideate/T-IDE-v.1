import * as vscode from 'vscode';

export enum PreviewState {
    CLOSED,
    OPENING,
    LOADING,
    READY,
    ERROR
}

export class PreviewIntegration {
    private previewFrame: any = null;
    private state: PreviewState = PreviewState.CLOSED;

    constructor() {
        // Initialize
    }

    /**
     * Open the Firebase Studio preview panel
     */
    async showPreview(): Promise<void> {
        this.state = PreviewState.OPENING;
        try {
            await vscode.commands.executeCommand('firebase.openPreview');
            this.state = PreviewState.LOADING;
            // Assumption: firebase.openPreview opens the panel
        } catch (error) {
            this.state = PreviewState.ERROR;
            console.error('Failed to open preview', error);
        }
    }

    /**
     * Refresh the preview after code changes
     */
    async reloadPreview(): Promise<void> {
        if (this.state === PreviewState.CLOSED) {
            return;
        }

        try {
            await vscode.commands.executeCommand('firebase.reloadPreview');

            // Wait for reload to complete
            await this.waitForPreviewReady();
        } catch (error) {
            console.error('Failed to reload preview', error);
        }
    }

    /**
     * Get the preview frame for console monitoring
     */
    getPreviewFrame(): any {
        return this.previewFrame;
    }

    /**
     * Wait for preview to be ready
     */
    private async waitForPreviewReady(): Promise<void> {
        const maxWait = 10000; // 10 seconds
        const interval = 100;
        let waited = 0;

        while (waited < maxWait) {
            try {
                // Check if preview is responding
                const isReady = await this.checkPreviewReady();
                if (isReady) {
                    this.state = PreviewState.READY;
                    return;
                }
            } catch {}

            await this.sleep(interval);
            waited += interval;
        }

        // Don't throw, just log. We don't want to crash everything if preview is slow.
        console.warn('Preview failed to become ready within timeout');
    }

    private async checkPreviewReady(): Promise<boolean> {
        // Implementation depends on FBS preview API
        // For now, assume true if command succeeded
        return true;
    }

    public getPreviewState(): PreviewState {
        return this.state;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
