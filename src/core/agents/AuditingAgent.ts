import { LLMClient } from '../llm/LLMClient';
import { ExecutionPlan } from './PlanningAgent';
import { RequirementsAccumulator } from '../../backend/tracker/RequirementsAccumulator';
import { CodeAnalyzer } from '../../backend/tracker/CodeAnalyzer';
import { ASTParser } from '../../backend/tracker/ASTParser';
import * as vscode from 'vscode';

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
    private requirementsTracker: RequirementsAccumulator;

    constructor(private llm: LLMClient) {
        // Initialize tracker - in a real app this might be injected
        const astParser = new ASTParser();
        const codeAnalyzer = new CodeAnalyzer(astParser);
        this.requirementsTracker = new RequirementsAccumulator(codeAnalyzer);
    }

    async review(plan: ExecutionPlan): Promise<AuditReport> {
        const prompt = this.buildAuditPrompt(plan);

        // Perform backend check: Scan codebase to get current requirements
        // We catch errors to ensure auditing doesn't fail completely if scanning fails
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspacePath) {
                await this.requirementsTracker.scanCodebase(workspacePath);
            }
        } catch (error) {
            console.error('Failed to scan codebase for auditing:', error);
        }

        const response = await this.llm.complete({
            systemPrompt: AUDITING_SYSTEM_PROMPT,
            userPrompt: prompt,
            responseFormat: 'json'
        });

        const report = this.parseAuditResponse(response.content, plan.taskId);

        // Enhance report with backend checks
        this.checkBackendRequirements(report);

        return report;
    }

    private checkBackendRequirements(report: AuditReport): void {
        const reqs = this.requirementsTracker.getRequirements();

        // We can check if the plan addresses detected security gaps.
        // For example, if we have requirements but no rules, we could flag it.
        // Or if the plan modifies backend files, we ensure it covers the requirements.

        if (reqs.collections.length > 0) {
            // Check if there are any obvious security issues detected by the scanner context (conceptually)
            // For now, we add a general check.
            const hasAuth = reqs.authProviders.size > 0;
            if (!hasAuth && reqs.collections.length > 0) {
                 report.issues.push({
                     type: 'security',
                     severity: 'high',
                     message: 'Backend uses Firestore collections but no Auth provider detected. Ensure security rules are not public.',
                     autoFixable: false
                 });
                 report.securityConcerns.push('Firestore collections detected without Auth provider.');
            }
        }
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
