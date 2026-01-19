import * as vscode from 'vscode';
import { ChecklistParser, ChecklistItem } from './ChecklistParser';
import { ChecklistManager } from '../agents/DocumentationAgent';
import { TaskResult } from '../agents/ExecutionAgent';
import { Task } from '../agents/PlanningAgent';

// Minimal interface definitions to replace 'any'
export interface CorrectionAttempt {
    attemptNumber: number;
    result: 'success' | 'partial' | 'failed' | 'pending';
    timestamp: Date;
    [key: string]: unknown; // Allow flexibility for now
}

interface WorkflowResult {
    success: boolean;
    task: Task;
    result?: TaskResult;
    attempts?: CorrectionAttempt[];
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
        try {
            const result = await vscode.window.showInformationMessage(
                'Continue autonomous execution?',
                'Continue',
                'Stop'
            );

            if (result !== 'Continue') {
                this.shouldStop = true;
            }
        } catch (e) {
            console.log('[Autonomous] Cannot ask for confirmation (VS Code API error). Stopping.');
            this.shouldStop = true;
        }
    }
}
