import * as vscode from 'vscode';
import { EmulatorManager } from './EmulatorManager';
import { PreviewIntegration } from './PreviewIntegration';
import { HotReloadCoordinator } from './HotReloadCoordinator';
import { ConsoleMonitor } from './ConsoleMonitor';
import { RuntimeErrorDetector } from '../core/verification/RuntimeErrorDetector';
import { EmulatorStatusBar } from './EmulatorStatusBar';

export class FirebaseServiceProvider {
    private static instance: FirebaseServiceProvider;

    public readonly emulatorManager: EmulatorManager;
    public readonly previewIntegration: PreviewIntegration;
    public readonly hotReloadCoordinator: HotReloadCoordinator;
    public readonly consoleMonitor: ConsoleMonitor;
    public readonly runtimeErrorDetector: RuntimeErrorDetector;
    public emulatorStatusBar: EmulatorStatusBar | undefined;

    private constructor() {
        this.emulatorManager = new EmulatorManager();
        this.previewIntegration = new PreviewIntegration();
        this.runtimeErrorDetector = new RuntimeErrorDetector(this.previewIntegration);
        this.consoleMonitor = new ConsoleMonitor(this.runtimeErrorDetector);
        this.hotReloadCoordinator = new HotReloadCoordinator(
            this.previewIntegration,
            this.runtimeErrorDetector
        );
    }

    public static getInstance(): FirebaseServiceProvider {
        if (!FirebaseServiceProvider.instance) {
            FirebaseServiceProvider.instance = new FirebaseServiceProvider();
        }
        return FirebaseServiceProvider.instance;
    }

    /**
     * Initialize services with extension context
     */
    public initialize(context: vscode.ExtensionContext): void {
        // Initialize Status Bar
        this.emulatorStatusBar = new EmulatorStatusBar(this.emulatorManager);
        context.subscriptions.push({ dispose: () => this.emulatorStatusBar?.dispose() });

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('tideate.startEmulators', async () => {
                await this.emulatorManager.startEmulators();
                this.updateStatusBar();
            }),
            vscode.commands.registerCommand('tideate.stopEmulators', async () => {
                await this.emulatorManager.stopEmulators();
                this.updateStatusBar();
            }),
            vscode.commands.registerCommand('tideate.toggleEmulators', async () => {
                const status = await this.emulatorManager.checkStatus();
                if (status.firestore || status.auth) {
                    await this.emulatorManager.stopEmulators();
                } else {
                    await this.emulatorManager.startEmulators();
                }
                this.updateStatusBar();
            }),
            vscode.commands.registerCommand('tideate.reloadPreview', async () => {
                await this.previewIntegration.reloadPreview();
            }),
             vscode.commands.registerCommand('tideate.showEmulatorUI', async () => {
                const status = await this.emulatorManager.checkStatus();
                if (status.uiUrl) {
                     vscode.env.openExternal(vscode.Uri.parse(status.uiUrl));
                } else {
                    vscode.window.showInformationMessage('Emulator UI is not running.');
                }
            })
        );

        // Read configuration
        const config = vscode.workspace.getConfiguration('tideate.firebase');
        const autoStart = config.get<boolean>('autoStartEmulators');

        if (autoStart) {
            this.emulatorManager.startEmulators().then(() => this.updateStatusBar());
        }

        // Start watching for hot reload if workspace is open
        if (vscode.workspace.rootPath) {
             this.hotReloadCoordinator.startWatching(vscode.workspace.rootPath);
        }
    }

    private async updateStatusBar() {
        if (this.emulatorStatusBar) {
            const status = await this.emulatorManager.checkStatus();
            this.emulatorStatusBar.updateStatus(status);
        }
    }
}
