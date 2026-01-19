import { LLMClient } from '../llm/LLMClient';
import { ContextResolver, ContextItem } from '../context/ContextResolver';

export interface PlanStep {
    id: string;
    type: 'create-file' | 'modify-file' | 'delete-file' | 'run-command';
    description: string;
    target?: string;
    details?: string;
}

export interface FileChange {
    path: string;
    description: string;
}

export interface Risk {
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
}

export interface ExecutionPlan {
    taskId: string;
    objective: string;
    steps: PlanStep[];
    estimatedChanges: FileChange[];
    risks: Risk[];
    rollbackStrategy: string;
}

export interface Task {
    id: string;
    name: string;
    description: string;
    checklistItem?: string;
    acceptanceCriteria?: string[];
}

const PLANNING_SYSTEM_PROMPT = `
You are an expert software architect and planning agent for the Tideate IDE.
Your goal is to create a detailed, step-by-step execution plan for a given task.
You will be provided with the task description and relevant context.

Output Format:
You must strictly output a valid JSON object matching the ExecutionPlan interface.
Do not include any markdown formatting or explanations outside the JSON.

Interface:
{
    "taskId": "string",
    "objective": "string (clear and concise)",
    "steps": [
        {
            "id": "step-1",
            "type": "create-file" | "modify-file" | "delete-file" | "run-command",
            "description": "string",
            "target": "file path or command",
            "details": "string (optional details)"
        }
    ],
    "estimatedChanges": [
        { "path": "string", "description": "string" }
    ],
    "risks": [
        { "description": "string", "severity": "low" | "medium" | "high", "mitigation": "string" }
    ],
    "rollbackStrategy": "string"
}
`;

export class PlanningAgent {
    constructor(
        private llm: LLMClient,
        private contextResolver: ContextResolver
    ) {}

    async createPlan(task: Task, contexts: ContextItem[]): Promise<ExecutionPlan> {
        const prompt = this.buildPlanningPrompt(task, contexts);

        const response = await this.llm.complete({
            systemPrompt: PLANNING_SYSTEM_PROMPT,
            userPrompt: prompt,
            responseFormat: 'json'
        });

        const plan = this.parsePlanResponse(response.content);

        // Validate plan structure
        this.validatePlanStructure(plan);

        // Ensure taskId matches
        plan.taskId = task.id;

        return plan;
    }

    private buildPlanningPrompt(task: Task, contexts: ContextItem[]): string {
        return `
## Task
${task.name}
${task.description}

## Acceptance Criteria
${task.acceptanceCriteria?.map(c => `- ${c}`).join('\n') || 'None'}

## Context
${contexts.map(c => `### ${c.mention}\n${c.content}`).join('\n\n')}

## Instructions
Create an execution plan with:
1. Clear objective statement
2. Step-by-step implementation plan
3. Files to create/modify
4. Potential risks
5. Rollback strategy

Respond in JSON format matching the ExecutionPlan interface.
        `.trim();
    }

    private parsePlanResponse(content: string): ExecutionPlan {
        try {
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to parse plan response: ${error}`);
        }
    }

    private validatePlanStructure(plan: ExecutionPlan): void {
        if (!plan.objective) throw new Error('Plan missing objective');
        if (!plan.steps || plan.steps.length === 0) throw new Error('Plan has no steps');
        if (!plan.rollbackStrategy) throw new Error('Plan missing rollback strategy');

        for (const step of plan.steps) {
            if (!step.type || !step.description) {
                throw new Error(`Step ${step.id} is missing type or description`);
            }
        }
    }
}
