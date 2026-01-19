import { ExecutionAgent, TaskResult, FileInfo, CorrectionAttemptResult } from '../agents/ExecutionAgent';
import { VerificationPipeline } from './VerificationPipeline';
import { RuntimeErrorDetector } from './RuntimeErrorDetector';

// Define HolisticChecker locally since it might be missing too, or just mock/interface it if simple
// TDD Part 5 mentions HolisticConsistencyChecker.
// For now I'll define a minimal version or interface.
interface HolisticConsistencyChecker {
    checkAll(result: TaskResult): Promise<VerificationIssue[]>;
}

export interface VerificationIssue {
    type: 'runtime' | 'consistency' | 'build' | 'lint' | 'test';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    location?: string;
    suggestedFix?: string;
    details?: unknown;
}

export interface CorrectionAttempt {
    attemptNumber: number;
    issues: VerificationIssue[];
    fixStrategy: FixStrategy;
    changes: FileInfo[];
    result: 'success' | 'partial' | 'failed' | 'pending';
    timestamp: Date;
}

export interface FixStrategy {
    approach: 'fix-build-first' | 'fix-runtime' | 'fix-consistency' | 'fix-all';
    targetIssues: VerificationIssue[];
    reasoning: string;
}

export interface CorrectionResult {
    success: boolean;
    finalResult: TaskResult;
    attempts: CorrectionAttempt[];
    message: string;
    remainingIssues?: VerificationIssue[];
    escalationReason?: string;
}

interface SelfCorrectionContext {
    taskId: string;
    originalResult: TaskResult;
    attempts: CorrectionAttempt[];
    maxAttempts: number;
    currentState: 'verifying' | 'correcting' | 'complete' | 'escalated';
}

interface SelfCorrectionDependencies {
    runtimeDetector: RuntimeErrorDetector;
    holisticChecker: HolisticConsistencyChecker;
    verificationPipeline: VerificationPipeline;
    executionAgent: ExecutionAgent;
}

export class SelfCorrectionLoop {
    private readonly maxAttempts = 3;
    private readonly runtimeDetector: RuntimeErrorDetector;
    private readonly holisticChecker: HolisticConsistencyChecker;
    private readonly verificationPipeline: VerificationPipeline;
    private readonly executionAgent: ExecutionAgent;

    constructor(deps: SelfCorrectionDependencies) {
        this.runtimeDetector = deps.runtimeDetector;
        this.holisticChecker = deps.holisticChecker;
        this.verificationPipeline = deps.verificationPipeline;
        this.executionAgent = deps.executionAgent;
    }

    /**
     * Main entry point: Verify and correct until success or escalation
     */
    async verifyAndCorrect(result: TaskResult): Promise<CorrectionResult> {
        const context: SelfCorrectionContext = {
            taskId: result.taskId,
            originalResult: result,
            attempts: [],
            maxAttempts: this.maxAttempts,
            currentState: 'verifying'
        };

        let currentResult = result;

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            console.log(`[Self-Correction] Verification attempt ${attempt}/${this.maxAttempts}`);

            // Run all verification checks
            const issues = await this.runAllVerification(currentResult);

            // If no issues, we're done!
            if (issues.length === 0) {
                context.currentState = 'complete';
                return {
                    success: true,
                    finalResult: currentResult,
                    attempts: context.attempts,
                    message: attempt === 1
                        ? 'All checks passed on first attempt'
                        : `Fixed after ${attempt - 1} correction(s)`
                };
            }

            // Record this attempt
            const attemptRecord: CorrectionAttempt = {
                attemptNumber: attempt,
                issues,
                fixStrategy: this.determineFixStrategy(issues),
                changes: [],
                result: 'pending',
                timestamp: new Date()
            };

            // If this is the last attempt, escalate
            if (attempt === this.maxAttempts) {
                context.currentState = 'escalated';
                attemptRecord.result = 'failed';
                context.attempts.push(attemptRecord);

                return {
                    success: false,
                    finalResult: currentResult,
                    attempts: context.attempts,
                    message: `Unable to resolve after ${this.maxAttempts} attempts`,
                    remainingIssues: issues,
                    escalationReason: this.formatEscalationReason(issues)
                };
            }

            // Attempt correction
            context.currentState = 'correcting';
            console.log(`[Self-Correction] Attempting fix for ${issues.length} issue(s)`);

            const correction = await this.attemptCorrection(currentResult, issues);

            attemptRecord.changes = correction.changes;
            attemptRecord.result = correction.success ? 'success' : 'partial';
            context.attempts.push(attemptRecord);

            if (correction.success) {
                currentResult = correction.updatedResult;
            } else {
                // Correction failed, but we'll try verification again
                // Maybe partial fixes were applied
                currentResult = correction.updatedResult;
            }
        }

        // Should never reach here due to loop logic, but TypeScript needs it
        return {
            success: false,
            finalResult: currentResult,
            attempts: context.attempts,
            message: 'Unexpected exit from correction loop'
        };
    }

    /**
     * Run all verification checks and aggregate issues
     */
    private async runAllVerification(result: TaskResult): Promise<VerificationIssue[]> {
        const allIssues: VerificationIssue[] = [];

        // 1. Runtime Error Detection (from preview console)
        console.log('  → Checking runtime errors...');
        const runtimeErrors = await this.runtimeDetector.detect();
        allIssues.push(...runtimeErrors.map(e => ({
            type: 'runtime' as const,
            severity: e.isFatal ? 'critical' as const : 'high' as const,
            message: e.message,
            location: e.location,
            suggestedFix: e.suggestedFix
        })));

        // 2. Holistic Consistency Checks
        console.log('  → Checking consistency...');
        const consistencyIssues = await this.holisticChecker.checkAll(result);
        allIssues.push(...consistencyIssues);

        // 3. Deterministic Verification Pipeline
        console.log('  → Running verification pipeline...');
        const pipelineReport = await this.verificationPipeline.runAll();

        if (!pipelineReport.typescript.passed) {
            allIssues.push({
                type: 'build',
                severity: 'critical',
                message: 'TypeScript compilation failed',
                details: pipelineReport.typescript.errors
            });
        }

        if (!pipelineReport.eslint.passed) {
            allIssues.push(...pipelineReport.eslint.errors.map(e => ({
                type: 'lint' as const,
                severity: e.severity === 'error' ? 'high' as const : 'medium' as const,
                message: e.message,
                location: e.file + ':' + e.line
            })));
        }

        if (!pipelineReport.tests.passed) {
            allIssues.push({
                type: 'test',
                severity: 'high',
                message: `${pipelineReport.tests.failed} test(s) failed`,
                details: pipelineReport.tests.failures
            });
        }

        if (!pipelineReport.build.passed) {
            allIssues.push({
                type: 'build',
                severity: 'critical',
                message: 'Build failed',
                details: pipelineReport.build.errors
            });
        }

        // Deduplicate and prioritize
        return this.deduplicateAndPrioritize(allIssues);
    }

    /**
     * Determine the best strategy for fixing issues
     */
    private determineFixStrategy(issues: VerificationIssue[]): FixStrategy {
        // Priority: critical build errors first, then runtime, then consistency
        const hasCriticalBuild = issues.some(i => i.type === 'build' && i.severity === 'critical');
        const hasRuntimeErrors = issues.some(i => i.type === 'runtime');
        const hasConsistencyIssues = issues.some(i => i.type === 'consistency');

        if (hasCriticalBuild) {
            return {
                approach: 'fix-build-first',
                targetIssues: issues.filter(i => i.type === 'build'),
                reasoning: 'Cannot verify runtime without successful build'
            };
        }

        if (hasRuntimeErrors) {
            return {
                approach: 'fix-runtime',
                targetIssues: issues.filter(i => i.type === 'runtime'),
                reasoning: 'Runtime errors prevent feature from working'
            };
        }

        if (hasConsistencyIssues) {
            return {
                approach: 'fix-consistency',
                targetIssues: issues.filter(i => i.type === 'consistency'),
                reasoning: 'Code-documentation consistency required'
            };
        }

        return {
            approach: 'fix-all',
            targetIssues: issues,
            reasoning: 'Mixed issues, attempting comprehensive fix'
        };
    }

    /**
     * Attempt to fix issues using the execution agent
     */
    private async attemptCorrection(
        result: TaskResult,
        issues: VerificationIssue[]
    ): Promise<CorrectionAttemptResult> {
        const strategy = this.determineFixStrategy(issues);

        // Build a correction prompt for the execution agent
        const correctionPrompt = this.buildCorrectionPrompt(result, strategy);

        try {
            // Execute the correction
            const correctionResult = await this.executionAgent.executeCorrection({
                originalTask: result.task,
                issues: strategy.targetIssues,
                prompt: correctionPrompt,
                constraints: {
                    preserveWorkingCode: true,
                    minimalChanges: true,
                    targetFiles: this.identifyTargetFiles(issues)
                }
            });

            return {
                success: true,
                changes: correctionResult.changes,
                updatedResult: {
                    ...result,
                    filesModified: [
                        ...result.filesModified,
                        ...correctionResult.changes.map(c => ({
                            path: c.path,
                            content: c.content,
                            changeType: 'correction' as const
                        }))
                    ]
                }
            };
        } catch (error: any) {
            console.error('[Self-Correction] Correction attempt failed:', error);
            return {
                success: false,
                changes: [],
                updatedResult: result,
                error: error.message || String(error)
            };
        }
    }

    /**
     * Build a targeted correction prompt
     */
    private buildCorrectionPrompt(result: TaskResult, strategy: FixStrategy): string {
        const issueDescriptions = strategy.targetIssues
            .map(i => `- [${i.severity.toUpperCase()}] ${i.message}${i.location ? ` at ${i.location}` : ''}`)
            .join('\n');

        return `
## Self-Correction Required

The previous implementation has the following issues that need to be fixed:

${issueDescriptions}

### Strategy: ${strategy.approach}
${strategy.reasoning}

### Constraints
- Make MINIMAL changes to fix the issues
- Do NOT refactor unrelated code
- Preserve all working functionality
- Focus only on the specific errors

### Files to examine
${this.identifyTargetFiles(strategy.targetIssues).join('\n')}

Fix these issues and report what was changed.
        `.trim();
    }

    private deduplicateAndPrioritize(issues: VerificationIssue[]): VerificationIssue[] {
        // Remove duplicates by message
        const seen = new Map<string, VerificationIssue>();
        for (const issue of issues) {
            const key = `${issue.type}:${issue.message}`;
            if (!seen.has(key) ||
                this.severityRank(issue.severity) > this.severityRank(seen.get(key)!.severity)) {
                seen.set(key, issue);
            }
        }

        // Sort by severity
        return Array.from(seen.values()).sort((a, b) =>
            this.severityRank(b.severity) - this.severityRank(a.severity)
        );
    }

    private severityRank(severity: string): number {
        const ranks = { critical: 4, high: 3, medium: 2, low: 1 };
        return ranks[severity as keyof typeof ranks] || 0;
    }

    private identifyTargetFiles(issues: VerificationIssue[]): string[] {
        const files = new Set<string>();
        for (const issue of issues) {
            if (issue.location) {
                const file = issue.location.split(':')[0];
                files.add(file);
            }
        }
        return Array.from(files);
    }

    private formatEscalationReason(issues: VerificationIssue[]): string {
        return `
Unable to automatically resolve the following issues after ${this.maxAttempts} attempts:

${issues.map(i => `• [${i.severity}] ${i.message}`).join('\n')}

Please review and provide guidance.
        `.trim();
    }
}
