export interface ChecklistItem {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    subtasks: ChecklistItem[];
    acceptanceCriteria: string[];
    priority: 'high' | 'medium' | 'low';
    phase: string;
}

export interface Progress {
    overall: {
        total: number;
        completed: number;
        percentage: number;
    };
    byPhase: Record<string, {
        total: number;
        completed: number;
    }>;
}

export class ChecklistParser {
    /**
     * Parse a markdown checklist into structured items
     */
    parse(markdown: string): ChecklistItem[] {
        const lines = markdown.split('\n');
        const items: ChecklistItem[] = [];
        let currentItem: ChecklistItem | null = null;
        let currentPhase = 'Phase 1';
        let itemCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Phase header
            const phaseMatch = line.match(/^##\s+Phase\s+(\d+)/i);
            if (phaseMatch) {
                currentPhase = `Phase ${phaseMatch[1]}`;
                // Also check for section headers which might imply phase or grouping
                continue;
            }

            // Check for other headers that might be treated as phases if "Phase N" format is not strictly used
            const headerMatch = line.match(/^##\s+(.+)/);
            if (headerMatch && !phaseMatch) {
                 // For now, only explicit Phase N headers change phase, or we can treat Sections as Phases
                 if (headerMatch[1].toLowerCase().includes('section')) {
                     // Maybe update currentPhase to include Section?
                     // TDD example: "Section 1: LLM Client Abstraction"
                     // We can treat this as part of the phase or a new grouping.
                     // The TDD parser logic shows "Phase N".
                 }
            }

            // Main checkbox item
            const checkboxMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/i);
            if (checkboxMatch) {
                if (currentItem) {
                    items.push(currentItem);
                }

                itemCount++;
                currentItem = {
                    id: `item-${itemCount}`,
                    title: checkboxMatch[2].trim(),
                    description: '',
                    completed: checkboxMatch[1].toLowerCase() === 'x',
                    subtasks: [],
                    acceptanceCriteria: [],
                    priority: 'medium',
                    phase: currentPhase
                };
                continue;
            }

            // Subtask (indented checkbox)
            const subtaskMatch = line.match(/^\s+-\s+\[([ x])\]\s+(.+)/i);
            if (subtaskMatch && currentItem) {
                currentItem.subtasks.push({
                    id: `${currentItem.id}-sub-${currentItem.subtasks.length + 1}`,
                    title: subtaskMatch[2].trim(),
                    description: '',
                    completed: subtaskMatch[1].toLowerCase() === 'x',
                    subtasks: [],
                    acceptanceCriteria: [],
                    priority: 'medium',
                    phase: currentPhase
                });
                continue;
            }

            // Acceptance criteria
            const criteriaMatch = line.match(/^\s+-\s+Acceptance:\s+(.+)/i);
            if (criteriaMatch && currentItem) {
                currentItem.acceptanceCriteria.push(criteriaMatch[1].trim());
                continue;
            }

            // Description (indented text or text under item)
            // TDD regex: /^\s+-\s+/ implies list item under the checkbox item
            if (line.match(/^\s+-\s+/) && currentItem && !subtaskMatch && !criteriaMatch) {
                // This captures other list items under the task as description
                currentItem.description += line.replace(/^\s+-\s+/, '') + ' ';
            } else if (currentItem && line.trim() !== '' && !line.startsWith('#') && !line.startsWith('-')) {
                 // Also capture plain text lines
                 currentItem.description += line.trim() + ' ';
            }
        }

        if (currentItem) {
            items.push(currentItem);
        }

        return items;
    }

    /**
     * Get next uncompleted item
     */
    getNextUncompleted(items: ChecklistItem[]): ChecklistItem | null {
        for (const item of items) {
            if (!item.completed) {
                return item;
            }
            // Check subtasks?
            // Usually main items are the tasks. Subtasks might be part of the main task execution.
            // If main item is not completed, we return it.
        }
        return null;
    }

    /**
     * Calculate progress
     */
    calculateProgress(items: ChecklistItem[]): Progress {
        const total = items.length;
        const completed = items.filter(i => i.completed).length;

        const byPhase: Record<string, { total: number; completed: number }> = {};

        for (const item of items) {
            if (!byPhase[item.phase]) {
                byPhase[item.phase] = { total: 0, completed: 0 };
            }
            byPhase[item.phase].total++;
            if (item.completed) {
                byPhase[item.phase].completed++;
            }
        }

        return {
            overall: { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 },
            byPhase
        };
    }
}
