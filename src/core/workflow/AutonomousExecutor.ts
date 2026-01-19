import { ChecklistParser, ChecklistItem } from './ChecklistParser';
import { ChecklistManager } from '../agents/DocumentationAgent';
import { TaskResult } from '../agents/ExecutionAgent';
import { Task } from '../agents/PlanningAgent';

// We need an interface for WorkflowOrchestrator since it's in Checklist 2 (not yet implemented fully)
// But we need to define AutonomousExecutor which depends on it.
// I will define a minimal interface here or assume it exists.
// TDD says: "AutonomousExecutor uses WorkflowOrchestrator from Checklist 2"
// I should define the interface locally if I can't import it.

interface WorkflowResult {
    success: boolean;
    task: Task;
    result?: TaskResult;
    attempts?: any;
    error?: string;
    rollbackPerformed?: boolean;
}

interface WorkflowOrchestrator {
    executeTask(task: Task): Promise<WorkflowResult>;
}

export interface AutonomousConfig {
    pauseBetweenTasks: boolean;
    pauseDuration: number; // ms
    maxConsecutiveTasks: number;
    stopOnFailure: boolean;
    requireConfirmation: boolean;
}

export interface AutonomousResult {
    tasksAttempted: number;
    tasksSucceeded: number;
    tasksFailed: number;
    results: TaskResult[];
    stoppedByUser: boolean;
}

export class AutonomousExecutor {
    private isRunning = false;
    private shouldStop = false;

    constructor(
        private orchestrator: WorkflowOrchestrator,
        private checklistParser: ChecklistParser,
        private checklistManager: ChecklistManager,
        private config: AutonomousConfig
    ) {}

    /**
     * Start autonomous execution of checklist
     */
    async start(): Promise<AutonomousResult> {
        if (this.isRunning) {
            throw new Error('Autonomous execution already in progress');
        }

        this.isRunning = true;
        this.shouldStop = false;

        const results: TaskResult[] = [];
        let consecutiveCount = 0;

        try {
            while (!this.shouldStop) {
                // Parse current checklist state
                const checklistContent = await this.checklistManager.read();
                const items = this.checklistParser.parse(checklistContent);

                // Get next uncompleted item
                const nextItem = this.checklistParser.getNextUncompleted(items);

                if (!nextItem) {
                    console.log('[Autonomous] All tasks complete!');
                    break;
                }

                // Check consecutive limit
                if (consecutiveCount >= this.config.maxConsecutiveTasks) {
                    console.log('[Autonomous] Reached max consecutive tasks, pausing');
                    if (this.config.requireConfirmation) {
                        await this.waitForConfirmation();
                    }
                    consecutiveCount = 0;
                }

                // Convert checklist item to task
                const task = this.itemToTask(nextItem);

                console.log(`[Autonomous] Starting task: ${task.name}`);

                // Execute task through orchestrator
                const result = await this.orchestrator.executeTask(task);
                if (result.result) {
                    results.push(result.result);
                }

                if (!result.success) {
                    console.log(`[Autonomous] Task failed: ${result.error}`);
                    if (this.config.stopOnFailure) {
                        break;
                    }
                }

                consecutiveCount++;

                // Pause between tasks if configured
                if (this.config.pauseBetweenTasks && !this.shouldStop) {
                    console.log(`[Autonomous] Pausing for ${this.config.pauseDuration}ms`);
                    await this.sleep(this.config.pauseDuration);
                }
            }
        } finally {
            this.isRunning = false;
        }

        return {
            tasksAttempted: results.length,
            tasksSucceeded: results.filter(r => r.success).length,
            tasksFailed: results.filter(r => !r.success).length,
            results,
            stoppedByUser: this.shouldStop
        };
    }

    /**
     * Stop autonomous execution
     */
    stop(): void {
        this.shouldStop = true;
    }

    /**
     * Check if currently running
     */
    isExecuting(): boolean {
        return this.isRunning;
    }

    private itemToTask(item: ChecklistItem): Task {
        return {
            id: item.id,
            name: item.title,
            description: item.description || item.title,
            checklistItem: item.id,
            acceptanceCriteria: item.acceptanceCriteria
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async waitForConfirmation(): Promise<void> {
        // In VS Code, this would show a dialog
        // We need to handle this carefully if running in a headless environment
        // NOTE: This direct VS Code API usage is temporary and will be replaced by host bridge
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const vscode = require('vscode');
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            const result = await (vscode.window as any).showInformationMessage(
                'Continue autonomous execution?',
                'Continue',
                'Stop'
            );

            if (result !== 'Continue') {
                this.shouldStop = true;
            }
        } catch (e) {
            // Likely not in VS Code environment, assume continue or stop?
            // For safety, maybe stop if we can't ask?
            console.log('[Autonomous] Cannot ask for confirmation (VS Code API missing). Stopping.');
            this.shouldStop = true;
        }
    }
}
