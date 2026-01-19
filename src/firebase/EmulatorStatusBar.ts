import * as vscode from 'vscode';
import { EmulatorManager, EmulatorStatus } from './EmulatorManager';

export class EmulatorStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private emulatorManager: EmulatorManager;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(emulatorManager: EmulatorManager) {
        this.emulatorManager = emulatorManager;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'tideate.toggleEmulators';
        this.updateStatus(this.emulatorManager.getStatus());
        this.statusBarItem.show();

        // Start polling for status updates (e.g. every 5 seconds) to keep UI in sync
        // In a real event-driven system, EmulatorManager would emit events.
        // For now, simple polling is robust enough.
        this.updateInterval = setInterval(async () => {
            const status = await this.emulatorManager.checkStatus();
            this.updateStatus(status);
        }, 5000);
    }

    public updateStatus(status: EmulatorStatus) {
        const isRunning = status.firestore || status.auth || status.functions; // Any running?

        if (isRunning) {
            this.statusBarItem.text = '$(flame) Emulators: Active';
            this.statusBarItem.backgroundColor = undefined; // Default color
            this.statusBarItem.tooltip = this.buildTooltip(status);
        } else {
            this.statusBarItem.text = '$(circle-slash) Emulators: Stopped';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = 'Click to start Firebase Emulators';
        }
    }

    private buildTooltip(status: EmulatorStatus): string {
        const lines = [
            'Firebase Emulators Status:',
            `• Auth: ${status.auth ? 'Running' : 'Stopped'}`,
            `• Firestore: ${status.firestore ? 'Running' : 'Stopped'}`,
            `• Storage: ${status.storage ? 'Running' : 'Stopped'}`,
            `• Functions: ${status.functions ? 'Running' : 'Stopped'}`,
            '',
            status.uiUrl ? `UI: ${status.uiUrl}` : 'UI: N/A',
            '',
            'Click to Stop'
        ];
        return lines.join('\n');
    }

    public dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.statusBarItem.dispose();
    }
}
