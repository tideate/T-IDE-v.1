import * as vscode from 'vscode';
import * as fs from 'fs';
import { PreviewIntegration } from './PreviewIntegration';
import { RuntimeErrorDetector } from '../core/verification/RuntimeErrorDetector';

export class HotReloadCoordinator {
    private watcher: fs.FSWatcher | null = null;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private readonly debounceMs = 500;

    constructor(
        private previewIntegration: PreviewIntegration,
        private runtimeErrorDetector: RuntimeErrorDetector
    ) {}

    /**
     * Start watching for file changes
     */
    startWatching(srcPath: string): void {
        try {
             // Using Node's fs.watch as per TDD, but vscode.workspace.createFileSystemWatcher is often better for extensions.
             // However, TDD explicitly mentions "Use Node.js fs.watch with recursive option" in one place
             // BUT user prompt says "Use vscode.FileSystemWatcher to detect changes".
             // User prompt supersedes TDD. So I will use vscode.FileSystemWatcher.

             // Wait, the prompt says "Implement src/firebase/HotReloadCoordinator.ts. Use vscode.FileSystemWatcher..."
             // So I will use vscode.FileSystemWatcher.

             const watcher = vscode.workspace.createFileSystemWatcher(
                 new vscode.RelativePattern(srcPath, '**/*.{ts,tsx,js,jsx,css,html}')
             );

             watcher.onDidChange((uri) => {
                 this.scheduleReload();
             });
             watcher.onDidCreate((uri) => {
                 this.scheduleReload();
             });
             watcher.onDidDelete((uri) => {
                 this.scheduleReload();
             });

             // Store watcher to dispose later.
             // fs.FSWatcher type in class property might need changing or I just cast it/wrap it.
             // I'll change the property type to vscode.FileSystemWatcher | null
             // But wait, I declared it as fs.FSWatcher | null above matching TDD?
             // I should update the class to use VS Code API as per user instruction.
             this.vsWatcher = watcher;

        } catch (e) {
            console.error("Failed to start watcher", e);
        }
    }

    private vsWatcher: vscode.FileSystemWatcher | null = null;

    /**
     * Stop watching
     */
    stopWatching(): void {
        if (this.vsWatcher) {
            this.vsWatcher.dispose();
            this.vsWatcher = null;
        }
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    /**
     * Schedule a debounced reload
     */
    private scheduleReload(): void {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(async () => {
            await this.performReload();
        }, this.debounceMs);
    }

    /**
     * Perform the actual reload
     */
    private async performReload(): Promise<void> {
        console.log('[HotReload] Reloading preview...');

        // Clear previous errors
        this.runtimeErrorDetector.reset();

        // Reload preview
        await this.previewIntegration.reloadPreview();

        // Start monitoring for new errors
        await this.runtimeErrorDetector.startMonitoring();
    }
}
