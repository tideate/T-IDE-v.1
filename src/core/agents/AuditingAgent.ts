import { LLMClient } from '../llm/LLMClient';
import { ExecutionPlan } from './PlanningAgent';

export interface AuditIssue {
    type: 'security' | 'architecture' | 'completeness' | 'other';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    location?: string;
    suggestedFix?: string;
    autoFixable: boolean;
}

export interface AuditReport {
    planId: string;
    approval: 'approved' | 'conditional' | 'rejected';
    issues: AuditIssue[];
    autoFixable: boolean;
    suggestions: string[];
    securityConcerns: string[];
}

const AUDITING_SYSTEM_PROMPT = `
You are an expert code auditor and security reviewer.
Your job is to review execution plans for the Tideate IDE.

Checklist:
1. Does the plan address the stated objective?
2. Are all necessary files identified?
3. Are there security concerns?
4. Is error handling considered?
5. Is rollback strategy sufficient?
6. Are there architectural violations?

Response Format:
You must strictly output a valid JSON object matching the AuditReport interface.

Interface:
{
    "planId": "string",
    "approval": "approved" | "conditional" | "rejected",
    "issues": [
        {
            "type": "security" | "architecture" | "completeness" | "other",
            "severity": "critical" | "high" | "medium" | "low",
            "message": "string",
            "location": "string (optional)",
            "suggestedFix": "string (optional)",
            "autoFixable": boolean
        }
    ],
    "autoFixable": boolean,
    "suggestions": ["string"],
    "securityConcerns": ["string"]
}

Approval Logic:
- No issues -> 'approved'
- Only auto-fixable issues -> 'conditional' with autoFixable=true
- Critical issues -> 'rejected'
- High non-auto-fixable issues -> 'rejected'
`;

export class AuditingAgent {
    constructor(private llm: LLMClient) {}

    async review(plan: ExecutionPlan): Promise<AuditReport> {
        const prompt = this.buildAuditPrompt(plan);

        const response = await this.llm.complete({
            systemPrompt: AUDITING_SYSTEM_PROMPT,
            userPrompt: prompt,
            responseFormat: 'json'
        });

        return this.parseAuditResponse(response.content, plan.taskId);
    }

    private buildAuditPrompt(plan: ExecutionPlan): string {
        return `
## Plan to Review
${JSON.stringify(plan, null, 2)}

## Audit Checklist
1. Does the plan address the stated objective?
2. Are all necessary files identified?
3. Are there any security concerns?
4. Is error handling considered?
5. Is the rollback strategy sufficient?
6. Are there any architectural violations?

## Response Format
Provide approval status, list any issues, and indicate if issues are auto-fixable.
        `.trim();
    }

    private parseAuditResponse(content: string, planId: string): AuditReport {
        try {
            const report = JSON.parse(content) as AuditReport;
            // Ensure planId matches
            report.planId = planId;
            return report;
        } catch (error) {
            throw new Error(`Failed to parse audit response: ${error}`);
        }
    }
}
