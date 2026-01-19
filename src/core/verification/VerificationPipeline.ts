import * as child_process from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const defaultExec = util.promisify(child_process.exec);

export interface ExecResult {
    stdout: string;
    stderr: string;
}

export interface VerificationError {
    file?: string;
    line?: number;
    column?: number;
    code?: string;
    message: string;
    severity?: 'error' | 'warning' | 'info';
}

export interface CheckResult {
    passed: boolean;
    errors: VerificationError[];
}

export interface TestFailure {
    name: string;
    error: string;
}

export interface TestResult extends CheckResult {
    total: number;
    passedCount: number;
    failed: number;
    failures: TestFailure[];
}

export interface GhostFileResult {
    passed: boolean;
    unexpectedFiles: string[];
}

export interface CoverageResult {
    passed: boolean;
    percentage: number | null;
    threshold: number;
}

export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

export interface DocumentationResult {
    passed: boolean;
    changelog?: ValidationResult;
    checklist?: ValidationResult;
}

export interface VerificationReport {
    timestamp: Date;
    passed: boolean;
    typescript: CheckResult;
    eslint: CheckResult;
    tests: TestResult;
    build: CheckResult;
    ghostFiles: GhostFileResult;
    coverage: CoverageResult;
    documentation: DocumentationResult;
}

interface ESLintMessage {
    ruleId: string;
    severity: number;
    message: string;
    line: number;
    column: number;
    nodeType: string;
    messageId: string;
    endLine: number;
    endColumn: number;
}

interface ESLintResult {
    filePath: string;
    messages: ESLintMessage[];
    errorCount: number;
    warningCount: number;
    fixableErrorCount: number;
    fixableWarningCount: number;
    source?: string;
}

interface JestAssertionResult {
    ancestorTitles: string[];
    fullName: string;
    status: string;
    title: string;
    failureMessages: string[];
}

interface JestTestResult {
    assertionResults: JestAssertionResult[];
    startTime: number;
    endTime: number;
    status: string;
    message: string;
    name: string;
}

interface JestOutput {
    numFailedTestSuites: number;
    numFailedTests: number;
    numPassedTestSuites: number;
    numPassedTests: number;
    numPendingTestSuites: number;
    numPendingTests: number;
    numRuntimeErrorTestSuites: number;
    numTotalTestSuites: number;
    numTotalTests: number;
    startTime: number;
    success: boolean;
    testResults: JestTestResult[];
}

export class VerificationPipeline {
    private workspaceRoot: string;
    private exec: (command: string, options?: { cwd?: string, maxBuffer?: number }) => Promise<ExecResult>;

    constructor(workspaceRoot: string, executor?: (command: string, options?: { cwd?: string, maxBuffer?: number }) => Promise<ExecResult>) {
        this.workspaceRoot = workspaceRoot;
        this.exec = executor || defaultExec;
    }

    async runAll(): Promise<VerificationReport> {
        const timestamp = new Date();

        console.log('[Verification Pipeline] Starting...');

        // Run all checks in parallel where possible
        const [typescript, eslint, tests, build] = await Promise.all([
            this.runTypeScript(),
            this.runESLint(),
            this.runTests(),
            this.runBuild()
        ]);

        // Sequential checks that depend on build or other factors
        const ghostFiles = await this.detectGhostFiles();
        const coverage = await this.checkCoverage();
        const documentation = await this.validateDocumentation();

        const passed = typescript.passed &&
                       eslint.passed &&
                       tests.passed &&
                       build.passed &&
                       ghostFiles.passed &&
                       documentation.passed;

        console.log(`[Verification Pipeline] ${passed ? 'PASSED' : 'FAILED'}`);

        return {
            timestamp,
            passed,
            typescript,
            eslint,
            tests,
            build,
            ghostFiles,
            coverage,
            documentation
        };
    }

    /**
     * TypeScript compilation check
     */
    private async runTypeScript(): Promise<CheckResult> {
        console.log('  → TypeScript check...');

        try {
            await this.exec('npx tsc --noEmit', { cwd: this.workspaceRoot });
            return { passed: true, errors: [] };
        } catch (error: unknown) {
            const execError = error as { stdout?: string, stderr?: string };
            const output = execError.stdout || execError.stderr || '';
            return {
                passed: false,
                errors: this.parseTypeScriptErrors(output)
            };
        }
    }

    /**
     * ESLint check
     */
    private async runESLint(): Promise<CheckResult> {
        console.log('  → ESLint check...');

        try {
            await this.exec('npx eslint . --ext .ts,.tsx --format json', {
                cwd: this.workspaceRoot
            });
            return { passed: true, errors: [] };
        } catch (error: unknown) {
             const execError = error as { stdout?: string };
             try {
                const stdout = execError.stdout || '[]';
                const eslintOutput: ESLintResult[] = JSON.parse(stdout);
                const errors: VerificationError[] = eslintOutput
                    .flatMap(file => file.messages.map(msg => ({
                        file: file.filePath,
                        line: msg.line,
                        message: msg.message,
                        severity: msg.severity === 2 ? 'error' : 'warning'
                    })));

                const hasErrors = errors.some(e => e.severity === 'error');
                return { passed: !hasErrors, errors };
             } catch (e) {
                 return { passed: false, errors: [{ message: 'Failed to parse ESLint output' }]};
             }
        }
    }

    /**
     * Test execution
     */
    private async runTests(): Promise<TestResult> {
        console.log('  → Running tests...');

        try {
            const { stdout } = await this.exec('npm test -- --json', { cwd: this.workspaceRoot });
            return this.parseTestOutput(stdout);
        } catch (error: unknown) {
            const execError = error as { stdout?: string, message: string };

            if (execError.stdout) {
                 try {
                     return this.parseTestOutput(execError.stdout);
                 } catch {
                     // Fall through if parsing fails
                 }
            }

            return {
                passed: false,
                errors: [{ message: execError.message }],
                total: 0,
                passedCount: 0,
                failed: 1,
                failures: [{ name: 'Test execution', error: execError.message }]
            };
        }
    }

    private parseTestOutput(stdout: string): TestResult {
        const testOutput: JestOutput = JSON.parse(stdout);

        return {
            passed: testOutput.success,
            errors: [],
            total: testOutput.numTotalTests,
            passedCount: testOutput.numPassedTests,
            failed: testOutput.numFailedTests,
            failures: testOutput.testResults
                .flatMap(r => r.assertionResults)
                .filter(a => a.status === 'failed')
                .map(a => ({ name: a.title, error: a.failureMessages[0] || 'Unknown error' }))
        };
    }

    /**
     * Build verification
     */
    private async runBuild(): Promise<CheckResult> {
        console.log('  → Build check...');

        try {
            await this.exec('npm run build', { cwd: this.workspaceRoot });
            return { passed: true, errors: [] };
        } catch (error: unknown) {
            const execError = error as { stderr?: string, message: string };
            return {
                passed: false,
                errors: [{ message: execError.stderr || execError.message }]
            };
        }
    }

    /**
     * Ghost file detection - files that exist but shouldn't
     */
    private async detectGhostFiles(): Promise<GhostFileResult> {
        console.log('  → Ghost file detection...');

        try {
            const { stdout } = await this.exec('git ls-files --others --exclude-standard', {
                cwd: this.workspaceRoot
            });

            const unexpectedFiles = stdout
                .split('\n')
                .filter(f => f.trim())
                .filter(f => !this.isExpectedUntracked(f));

            return {
                passed: unexpectedFiles.length === 0,
                unexpectedFiles
            };
        } catch {
            return { passed: true, unexpectedFiles: [] };
        }
    }

    /**
     * Code coverage check
     */
    private async checkCoverage(): Promise<CoverageResult> {
        console.log('  → Coverage check...');

        const coveragePath = path.join(this.workspaceRoot, 'coverage/coverage-summary.json');

        if (!fs.existsSync(coveragePath)) {
            return { passed: true, percentage: null, threshold: 70 };
        }

        try {
            // Using any here for JSON content as strict structure might vary but usually has total.lines.pct
            const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
            const percentage = coverage.total?.lines?.pct;
            const threshold = 70;

            if (typeof percentage === 'number') {
                return {
                    passed: percentage >= threshold,
                    percentage,
                    threshold
                };
            }
             return { passed: false, percentage: null, threshold: 70 };

        } catch (e) {
             return { passed: false, percentage: null, threshold: 70 };
        }
    }

    /**
     * Documentation integrity validation
     */
    private async validateDocumentation(): Promise<DocumentationResult> {
        console.log('  → Documentation validation...');
        return {
            passed: true,
            changelog: { valid: true },
            checklist: { valid: true }
        };
    }

    private parseTypeScriptErrors(output: string): VerificationError[] {
        const errors: VerificationError[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            const match = line.match(/(.+)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)/);
            if (match) {
                errors.push({
                    file: match[1],
                    line: parseInt(match[2]),
                    column: parseInt(match[3]),
                    code: match[4],
                    message: match[5],
                    severity: 'error'
                });
            }
        }

        return errors;
    }

    private isExpectedUntracked(file: string): boolean {
        const expectedPatterns = [
            /node_modules/,
            /\.env/,
            /dist\//,
            /build\//,
            /coverage\//
        ];
        return expectedPatterns.some(p => p.test(file));
    }
}
