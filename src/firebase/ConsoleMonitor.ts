import { RuntimeErrorDetector, RuntimeError } from '../core/verification/RuntimeErrorDetector';

export interface ConsoleMessage {
    type: 'log' | 'info' | 'warn' | 'error';
    message: string;
    stack?: string;
    timestamp: Date;
}

export interface PreviewFrame {
    // Defines the interface for the preview frame (e.g. webview)
    postMessage(message: unknown): Thenable<boolean>;
}

export interface PreviewMessage {
    type: string;
    message?: string;
    stack?: string;
    [key: string]: unknown;
}

export class ConsoleMonitor {
    private attachedFrame: PreviewFrame | null = null;
    private messageBuffer: ConsoleMessage[] = [];
    private readonly BUFFER_LIMIT = 1000;

    // Event listeners
    private listeners: Record<string, ((data: unknown) => void)[]> = {};

    constructor(private runtimeErrorDetector?: RuntimeErrorDetector) {}

    /**
     * Attach to preview frame
     */
    async attach(frame: PreviewFrame): Promise<void> {
        this.attachedFrame = frame;
        // In a real implementation we would inject a script into the webview/frame
    }

    /**
     * Handle incoming message from preview
     */
    public handleMessage(message: PreviewMessage): void {
        const consoleMsg: ConsoleMessage = {
            type: (message.type as 'log' | 'info' | 'warn' | 'error') || 'log',
            message: message.message || '',
            stack: message.stack,
            timestamp: new Date()
        };

        this.addToBuffer(consoleMsg);

        // Emit event
        this.emit(consoleMsg.type, consoleMsg);

        // If it's an error, notify detector
        if (consoleMsg.type === 'error' && this.runtimeErrorDetector) {
            const runtimeError: RuntimeError = {
                type: 'console-error',
                message: consoleMsg.message,
                stack: consoleMsg.stack,
                timestamp: consoleMsg.timestamp,
                isFatal: false // Console errors aren't always fatal
            };
            this.runtimeErrorDetector.addError(runtimeError);
        }
    }

    /**
     * Handle uncaught exception from preview
     */
    public handleException(error: Error): void {
         if (this.runtimeErrorDetector) {
            const runtimeError: RuntimeError = {
                type: 'exception',
                message: error.message || String(error),
                stack: error.stack,
                timestamp: new Date(),
                isFatal: true
            };
            this.runtimeErrorDetector.addError(runtimeError);
             this.emit('error', runtimeError);
        }
    }

    private addToBuffer(msg: ConsoleMessage) {
        this.messageBuffer.push(msg);
        if (this.messageBuffer.length > this.BUFFER_LIMIT) {
            this.messageBuffer.shift();
        }
    }

    public getRecentMessages(count: number = 100): ConsoleMessage[] {
        return this.messageBuffer.slice(-count);
    }

    public clearBuffer(): void {
        this.messageBuffer = [];
    }

    public on(event: string, callback: (data: unknown) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    private emit(event: string, data: unknown): void {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}
