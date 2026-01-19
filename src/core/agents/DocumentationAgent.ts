export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

export interface DocumentValidator {
    validateChangelog(): Promise<ValidationResult>;
    validateChangelogUpdate(before: string, after: string): ValidationResult;
    validateChecklist(): Promise<ValidationResult>;
    validateChecklistUpdate(before: string, after: string): ValidationResult;
}

export interface ChangelogManager {
    read(): Promise<string>;
    addEntry(entry: string): Promise<void>;
    write(content: string): Promise<void>;
}

export interface ChecklistManager {
    read(): Promise<string>;
    markComplete(itemId: string): Promise<void>;
    write(content: string): Promise<void>;
}

export interface DocumentationResult {
    success: boolean;
    changelogUpdated: boolean;
    checklistUpdated: boolean;
    error?: string;
}

import { TaskResult } from './ExecutionAgent';

export class DocumentationAgent {
    constructor(
        private changelogManager: ChangelogManager,
        private checklistManager: ChecklistManager,
        private validator: DocumentValidator
    ) {}

    async updateDocumentation(result: TaskResult): Promise<DocumentationResult> {
        // Capture before state
        const beforeChangelog = await this.changelogManager.read();
        const beforeChecklist = await this.checklistManager.read();

        // Update changelog
        const changelogEntry = this.formatChangelogEntry(result);
        await this.changelogManager.addEntry(changelogEntry);

        // Update checklist
        if (result.task.checklistItem) {
            await this.checklistManager.markComplete(result.task.checklistItem);
        }

        // Capture after state
        const afterChangelog = await this.changelogManager.read();
        const afterChecklist = await this.checklistManager.read();

        // Validate changes
        const changelogValid = this.validator.validateChangelogUpdate(beforeChangelog, afterChangelog);
        const checklistValid = this.validator.validateChecklistUpdate(beforeChecklist, afterChecklist);

        if (!changelogValid.valid || !checklistValid.valid) {
            // Rollback on validation failure
            await this.changelogManager.write(beforeChangelog);
            await this.checklistManager.write(beforeChecklist);

            throw new Error(`Documentation validation failed: ${changelogValid.reason || checklistValid.reason}`);
        }

        return {
            success: true,
            changelogUpdated: true,
            checklistUpdated: !!result.task.checklistItem
        };
    }

    private formatChangelogEntry(result: TaskResult): string {
        const date = new Date().toISOString().split('T')[0];

        return `
## [${date}] - ${result.task.name}

### ✅ Completed
- ${result.task.description}

### 📁 Files Created
${result.filesCreated.map(f => `- ${f.path}`).join('\n') || '- None'}

### 📝 Files Modified
${result.filesModified.map(f => `- ${f.path}`).join('\n') || '- None'}

---
        `.trim();
    }
}
