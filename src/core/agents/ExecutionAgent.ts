import { LLMClient } from '../llm/LLMClient';
import { FileSystemService } from '../services/FileSystemService';
import { ExecutionPlan, PlanStep, Task } from './PlanningAgent';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FileInfo {
    path: string;
    content?: string;
    changeType: 'created' | 'modified' | 'deleted' | 'correction';
}

export interface TaskResult {
    taskId: string;
    task: Task;
    success: boolean;
    filesCreated: FileInfo[];
    filesModified: FileInfo[];
    filesDeleted: string[];
    console: string[];
    errors: string[];
}

export interface CorrectionContext {
    originalTask: Task;
    issues: any[]; // VerificationIssue[]
    prompt: string;
    constraints: {
        preserveWorkingCode: boolean;
        minimalChanges: boolean;
        targetFiles: string[];
    };
}

export interface CorrectionAttemptResult {
    success: boolean;
    changes: FileInfo[];
    updatedResult: TaskResult;
    error?: string;
}

export class ExecutionAgent {
    constructor(
        private llm: LLMClient,
        private fileSystem: FileSystemService
    ) {}

    async execute(plan: ExecutionPlan): Promise<TaskResult> {
        const result: TaskResult = {
            taskId: plan.taskId,
            task: { id: plan.taskId, name: plan.objective, description: plan.objective } as Task, // Reconstruct task roughly
            success: false,
            filesCreated: [],
            filesModified: [],
            filesDeleted: [],
            console: [],
            errors: []
        };

        try {
            for (const step of plan.steps) {
                await this.executeStep(step, result);
            }
            result.success = true;
        } catch (error: any) {
            result.errors.push(error.message || String(error));
        }

        return result;
    }

    private async executeStep(step: PlanStep, result: TaskResult): Promise<void> {
        switch (step.type) {
            case 'create-file':
                await this.createFile(step, result);
                break;
            case 'modify-file':
                await this.modifyFile(step, result);
                break;
            case 'delete-file':
                await this.deleteFile(step, result);
                break;
            case 'run-command':
                await this.runCommand(step, result);
                break;
        }
    }

    private async createFile(step: PlanStep, result: TaskResult): Promise<void> {
        if (!step.target) throw new Error('Target is required for create-file');

        const prompt = `
Task: Create file ${step.target}
Description: ${step.description}
Details: ${step.details || ''}

Please provide the full content of the file.
Response must contain ONLY the file content.
        `;

        const response = await this.llm.complete({
            systemPrompt: 'You are an expert coder. Output only the file content.',
            userPrompt: prompt
        });

        // Strip markdown code blocks if present
        let content = response.content;
        const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            content = codeBlockMatch[1];
        }

        await this.fileSystem.writeFile(step.target, content);

        result.filesCreated.push({
            path: step.target,
            content: content,
            changeType: 'created'
        });
    }

    private async modifyFile(step: PlanStep, result: TaskResult): Promise<void> {
        if (!step.target) throw new Error('Target is required for modify-file');

        let currentContent = '';
        try {
            currentContent = await this.fileSystem.readFile(step.target);
        } catch (e) {
            throw new Error(`Cannot modify file ${step.target}: File does not exist`);
        }

        const prompt = `
Task: Modify file ${step.target}
Description: ${step.description}
Details: ${step.details || ''}

Current Content:
${currentContent}

Please provide the full updated content of the file.
Response must contain ONLY the file content.
        `;

        const response = await this.llm.complete({
            systemPrompt: 'You are an expert coder. Output only the updated file content.',
            userPrompt: prompt
        });

        let content = response.content;
        const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            content = codeBlockMatch[1];
        }

        await this.fileSystem.writeFile(step.target, content);

        result.filesModified.push({
            path: step.target,
            content: content,
            changeType: 'modified'
        });
    }

    private async deleteFile(step: PlanStep, result: TaskResult): Promise<void> {
         if (!step.target) throw new Error('Target is required for delete-file');
         await this.fileSystem.deleteFile(step.target);
         result.filesDeleted.push(step.target);
    }

    private async runCommand(step: PlanStep, result: TaskResult): Promise<void> {
        if (!step.target) throw new Error('Target (command) is required for run-command');

        try {
            const { stdout, stderr } = await execAsync(step.target);
            result.console.push(`Command: ${step.target}`);
            if (stdout) result.console.push(`STDOUT: ${stdout}`);
            if (stderr) result.console.push(`STDERR: ${stderr}`);
        } catch (error: any) {
            result.console.push(`Command failed: ${step.target}`);
            result.console.push(`Error: ${error.message}`);
            throw new Error(`Command failed: ${step.target}`);
        }
    }

    async executeCorrection(context: CorrectionContext): Promise<CorrectionAttemptResult> {
        // Implementation for correction loop interaction
        // This is simplified for now

        const changes: FileInfo[] = [];
        const result: TaskResult = {
            taskId: context.originalTask.id,
            task: context.originalTask,
            success: false,
            filesCreated: [],
            filesModified: [],
            filesDeleted: [],
            console: [],
            errors: []
        };

        // For each target file, ask LLM to fix issues
        for (const filePath of context.constraints.targetFiles) {
             try {
                const currentContent = await this.fileSystem.readFile(filePath);

                const prompt = `
${context.prompt}

Target File: ${filePath}

Current Content:
${currentContent}

Provide the corrected full content for this file.
                `;

                const response = await this.llm.complete({
                    systemPrompt: 'You are an expert coder fixing issues. Output only the corrected file content.',
                    userPrompt: prompt
                });

                let content = response.content;
                const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
                if (codeBlockMatch) {
                    content = codeBlockMatch[1];
                }

                await this.fileSystem.writeFile(filePath, content);

                const change: FileInfo = {
                    path: filePath,
                    content: content,
                    changeType: 'correction'
                };
                changes.push(change);
                result.filesModified.push(change);

             } catch (e) {
                 // Skip if file not found or other error, but log it
                 console.error(`Failed to correct ${filePath}:`, e);
             }
        }

        return {
            success: changes.length > 0,
            changes,
            updatedResult: result
        };
    }
}
