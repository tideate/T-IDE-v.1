import { VerificationPipeline, VerificationReport } from '../verification/VerificationPipeline';
import * as fs from 'fs';
import * as ts from 'typescript';

export interface GateResult {
    passed: boolean;
    issues: string[];
    autoFixed?: boolean;
    report?: VerificationReport;
}

export interface GateStats {
    totalAttempts: number;
    passed: number;
    failed: number;
    byGate: Record<number, { attempts: number; passed: number; failed: number }>;
}

// Interfaces stubbed for now
export interface ExecutionPlan {
    objective: string;
    steps: Array<{ type: string; description: string; }>;
    rollbackStrategy: string;
}

export interface AuditReport {
    approval: 'approved' | 'conditional' | 'rejected';
    autoFixable: boolean;
    issues: Array<{ message: string }>;
}

export interface TaskResult {
    errors: string[];
    filesCreated: Array<{ path: string }>;
}

export interface DocumentationResult {
    success: boolean;
}

// Stub DocumentValidator for now
export class DocumentValidator {
    async validateChangelog(): Promise<{ valid: boolean; reason?: string }> {
        return { valid: true }; // Stub
    }
    async validateChecklist(): Promise<{ valid: boolean; reason?: string }> {
         return { valid: true }; // Stub
    }
}

export class GateEnforcer {
    private stats: GateStats = {
        totalAttempts: 0,
        passed: 0,
        failed: 0,
        byGate: {
            1: { attempts: 0, passed: 0, failed: 0 },
            2: { attempts: 0, passed: 0, failed: 0 },
            3: { attempts: 0, passed: 0, failed: 0 },
            4: { attempts: 0, passed: 0, failed: 0 },
            5: { attempts: 0, passed: 0, failed: 0 }
        }
    };

    constructor(
        private validator: DocumentValidator,
        private verificationPipeline: VerificationPipeline
    ) {}

    /**
     * Gate 1: Validate execution plan
     */
    async enforceGate1(plan: ExecutionPlan): Promise<GateResult> {
        const issues: string[] = [];

        // Check plan has objective
        if (!plan.objective || plan.objective.length < 10) {
            issues.push('Plan objective is missing or too short');
        }

        // Check plan has steps
        if (!plan.steps || plan.steps.length === 0) {
            issues.push('Plan has no execution steps');
        }

        // Check each step is valid
        for (let i = 0; i < (plan.steps || []).length; i++) {
             const step = plan.steps[i];
            if (!step.type || !step.description) {
                issues.push(`Step ${i} is missing type or description`);
            }
        }

        // Check rollback strategy
        if (!plan.rollbackStrategy) {
            issues.push('Plan has no rollback strategy');
        }

        return {
            passed: issues.length === 0,
            issues
        };
    }

    /**
     * Gate 2: Validate audit results
     */
    async enforceGate2(audit: AuditReport): Promise<GateResult> {
        if (audit.approval === 'approved') {
            return { passed: true, issues: [] };
        }

        if (audit.approval === 'conditional' && audit.autoFixable) {
            return {
                passed: true,
                issues: audit.issues.map(i => i.message),
                autoFixed: true
            };
        }

        return {
            passed: false,
            issues: audit.issues.map(i => i.message)
        };
    }

    /**
     * Gate 3: Validate code execution
     */
    async enforceGate3(result: TaskResult): Promise<GateResult> {
        const issues: string[] = [];

        // Check for execution errors
        if (result.errors.length > 0) {
            issues.push(...result.errors);
        }

        // Check that expected files were created
        for (const file of result.filesCreated) {
            if (!fs.existsSync(file.path)) {
                issues.push(`Expected file not created: ${file.path}`);
            }
        }

        // Basic syntax check on created files
        for (const file of result.filesCreated) {
            if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
                const syntaxResult = await this.checkSyntax(file.path);
                if (!syntaxResult.valid) {
                    issues.push(`Syntax error in ${file.path}: ${syntaxResult.error}`);
                }
            }
        }

        return {
            passed: issues.length === 0,
            issues
        };
    }

    /**
     * Gate 4: Validate documentation updates
     */
    async enforceGate4(docs: DocumentationResult): Promise<GateResult> {
        const issues: string[] = [];

        if (!docs.success) {
            issues.push('Documentation update failed');
        }

        // Validate changelog
        const changelogResult = await this.validator.validateChangelog();
        if (!changelogResult.valid) {
            issues.push(`Changelog validation failed: ${changelogResult.reason}`);
        }

        // Validate checklist
        const checklistResult = await this.validator.validateChecklist();
        if (!checklistResult.valid) {
            issues.push(`Checklist validation failed: ${checklistResult.reason}`);
        }

        return {
            passed: issues.length === 0,
            issues
        };
    }

    /**
     * Gate 5: Run verification pipeline
     */
    async enforceGate5(): Promise<GateResult> {
        const report = await this.verificationPipeline.runAll();

        const issues: string[] = [];

        if (!report.typescript.passed) {
            issues.push('TypeScript compilation failed');
        }

        if (!report.eslint.passed) {
             const errorCount = report.eslint.errors.filter(e => e.severity === 'error').length;
             issues.push(`ESLint found ${errorCount} error(s)`);
        }

        if (!report.tests.passed) {
            issues.push(`${report.tests.failed} test(s) failed`);
        }

        if (!report.build.passed) {
            issues.push('Build failed');
        }

        if (!report.documentation.passed) {
            issues.push('Documentation integrity check failed');
        }

        return {
            passed: report.passed,
            issues,
            report
        };
    }

    private async checkSyntax(filePath: string): Promise<{ valid: boolean; error?: string }> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Use TypeScript compiler API for syntax check
            ts.transpileModule(content, {
                compilerOptions: { module: ts.ModuleKind.ESNext }
            });
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    async enforceGate(gateNumber: number, input: any): Promise<GateResult> {
        console.log(`[GateEnforcer] Enforcing Gate ${gateNumber}`);
        this.stats.totalAttempts++;
        if (!this.stats.byGate[gateNumber]) {
             this.stats.byGate[gateNumber] = { attempts: 0, passed: 0, failed: 0 };
        }
        this.stats.byGate[gateNumber].attempts++;

        let result: GateResult;

        switch (gateNumber) {
            case 1: result = await this.enforceGate1(input); break;
            case 2: result = await this.enforceGate2(input); break;
            case 3: result = await this.enforceGate3(input); break;
            case 4: result = await this.enforceGate4(input); break;
            case 5: result = await this.enforceGate5(); break;
            default: throw new Error(`Invalid gate number: ${gateNumber}`);
        }

        if (result.passed) {
            this.stats.passed++;
            this.stats.byGate[gateNumber].passed++;
        } else {
            this.stats.failed++;
            this.stats.byGate[gateNumber].failed++;
        }

        return result;
    }

    getGateStatistics(): GateStats {
        return {
            ...this.stats,
            byGate: {
                ...this.stats.byGate
            }
        };
    }
}
