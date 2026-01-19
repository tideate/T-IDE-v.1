import * as assert from 'assert';
import { VerificationPipeline } from '../../../core/verification/VerificationPipeline';

// Mock exec to avoid actually running commands
const mockExec = async (cmd: string, options: any) => {
    if (cmd.includes('tsc')) {
        return { stdout: '', stderr: '' };
    }
    if (cmd.includes('eslint')) {
        return { stdout: '[]', stderr: '' };
    }
    if (cmd.includes('npm test')) {
        return { stdout: JSON.stringify({
            success: true,
            numTotalTests: 5,
            numPassedTests: 5,
            numFailedTests: 0,
            testResults: []
        }), stderr: '' };
    }
    if (cmd.includes('npm run build')) {
        return { stdout: '', stderr: '' };
    }
    if (cmd.includes('git ls-files')) {
        return { stdout: '', stderr: '' };
    }
    return { stdout: '', stderr: '' };
};

describe('VerificationPipeline', () => {
    it('should instantiate', () => {
        const pipeline = new VerificationPipeline('.', mockExec);
        assert.ok(pipeline);
    });

    it('should runAll successfully', async () => {
        const pipeline = new VerificationPipeline('.', mockExec);
        const report = await pipeline.runAll();
        assert.ok(report.passed);
        assert.ok(report.typescript.passed);
        assert.ok(report.eslint.passed);
        assert.ok(report.tests.passed);
        assert.ok(report.build.passed);
    });

    it('should handle test failures correctly', async () => {
        const failureExec = async (cmd: string, options: any) => {
             if (cmd.includes('npm test')) {
                 const output = JSON.stringify({
                    success: false,
                    numTotalTests: 5,
                    numPassedTests: 4,
                    numFailedTests: 1,
                    testResults: [
                        {
                            assertionResults: [
                                {
                                    status: 'failed',
                                    title: 'test failed',
                                    failureMessages: ['Expected true to be false']
                                }
                            ]
                        }
                    ]
                 });
                 // Simulate error with stdout attached
                 const err: any = new Error('Command failed');
                 err.stdout = output;
                 throw err;
            }
            return mockExec(cmd, options);
        }

        const pipeline = new VerificationPipeline('.', failureExec);
        const report = await pipeline.runAll();
        assert.strictEqual(report.passed, false);
        assert.strictEqual(report.tests.passed, false);
        assert.strictEqual(report.tests.failed, 1);
        assert.strictEqual(report.tests.failures[0].error, 'Expected true to be false');
    });
});
