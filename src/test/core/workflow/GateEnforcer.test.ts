import * as assert from 'assert';
import { GateEnforcer, AuditReport, DocumentValidator } from '../../../core/workflow/GateEnforcer';
import { VerificationPipeline } from '../../../core/verification/VerificationPipeline';

// Mock VerificationPipeline
const mockExec = async (cmd: string) => ({ stdout: '', stderr: '' });
const pipeline = new VerificationPipeline('.', mockExec);

// Mock DocumentValidator
const docValidator = new DocumentValidator();

const gateEnforcer = new GateEnforcer(docValidator, pipeline);

describe('GateEnforcer Statistics', () => {

    it('should track gate statistics correctly', async () => {
        // Enforce Gate 2 twice, once passed, once failed
        const passedAudit: AuditReport = {
            approval: 'approved',
            autoFixable: false,
            issues: []
        };
        await gateEnforcer.enforceGate(2, passedAudit);

        const failedAudit: AuditReport = {
            approval: 'rejected',
            autoFixable: false,
            issues: [{ message: 'Bad code' }]
        };
        await gateEnforcer.enforceGate(2, failedAudit);

        const stats = gateEnforcer.getGateStatistics();

        assert.strictEqual(stats.totalAttempts, 2);
        assert.strictEqual(stats.passed, 1);
        assert.strictEqual(stats.failed, 1);

        // Gate 2 stats
        assert.strictEqual(stats.byGate[2].attempts, 2);
        assert.strictEqual(stats.byGate[2].passed, 1);
        assert.strictEqual(stats.byGate[2].failed, 1);

        // Gate 1 stats (unused)
        assert.strictEqual(stats.byGate[1].attempts, 0);
    });
});
