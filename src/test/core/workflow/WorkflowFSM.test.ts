import * as assert from 'assert';
import { WorkflowFSM, WorkflowState, WorkflowEvent } from '../../../core/workflow/WorkflowFSM';
import { GateEnforcer, AuditReport, DocumentValidator } from '../../../core/workflow/GateEnforcer';
import { VerificationPipeline } from '../../../core/verification/VerificationPipeline';

// Mock VerificationPipeline
const mockExec = async (cmd: string) => ({ stdout: '', stderr: '' });
const pipeline = new VerificationPipeline('.', mockExec);

// Mock DocumentValidator
const docValidator = new DocumentValidator();

const gateEnforcer = new GateEnforcer(docValidator, pipeline);

describe('WorkflowFSM & Gate Integration', () => {
    let fsm: WorkflowFSM;

    beforeEach(() => {
        fsm = new WorkflowFSM();
    });

    it('should initialize in IDLE state', () => {
        assert.strictEqual(fsm.getState(), WorkflowState.IDLE);
    });

    it('should transition to PLANNING on START_TASK', () => {
        const success = fsm.transition(WorkflowEvent.START_TASK);
        assert.strictEqual(success, true);
        assert.strictEqual(fsm.getState(), WorkflowState.PLANNING);
    });

    it('should BLOCK transition if Gate Enforcer fails (Simulated)', async () => {
        // Setup: Move FSM to AWAITING_AUDIT_GATE
        fsm.transition(WorkflowEvent.START_TASK); // IDLE -> PLANNING
        fsm.transition(WorkflowEvent.PLANNING_COMPLETE); // PLANNING -> AWAITING_PLAN_GATE
        fsm.transition(WorkflowEvent.PLAN_GATE_PASSED); // AWAITING_PLAN_GATE -> AUDITING
        fsm.transition(WorkflowEvent.AUDITING_COMPLETE); // AUDITING -> AWAITING_AUDIT_GATE

        assert.strictEqual(fsm.getState(), WorkflowState.AWAITING_AUDIT_GATE);

        // Simulation: Audit Agent returns failure
        const failedAudit: AuditReport = {
            approval: 'rejected',
            autoFixable: false,
            issues: [{ message: 'Security vulnerability detected' }]
        };

        const gateResult = await gateEnforcer.enforceGate2(failedAudit);

        // Assert Gate Logic
        assert.strictEqual(gateResult.passed, false);
        assert.deepStrictEqual(gateResult.issues, ['Security vulnerability detected']);

        // Assert FSM Logic based on Gate Result
        if (gateResult.passed) {
            fsm.transition(WorkflowEvent.AUDIT_GATE_PASSED);
        } else {
            fsm.transition(WorkflowEvent.AUDIT_GATE_FAILED);
        }

        assert.strictEqual(fsm.getState(), WorkflowState.PLANNING); // Should revert to PLANNING
    });

    it('should ALLOW transition if Gate Enforcer passes (Simulated)', async () => {
        // Setup: Move FSM to AWAITING_AUDIT_GATE
        fsm.transition(WorkflowEvent.START_TASK);
        fsm.transition(WorkflowEvent.PLANNING_COMPLETE);
        fsm.transition(WorkflowEvent.PLAN_GATE_PASSED);
        fsm.transition(WorkflowEvent.AUDITING_COMPLETE);

        assert.strictEqual(fsm.getState(), WorkflowState.AWAITING_AUDIT_GATE);

        // Simulation: Audit Agent returns success
        const passedAudit: AuditReport = {
            approval: 'approved',
            autoFixable: false,
            issues: []
        };

        const gateResult = await gateEnforcer.enforceGate2(passedAudit);

        // Assert Gate Logic
        assert.strictEqual(gateResult.passed, true);

        // Assert FSM Logic
        if (gateResult.passed) {
            fsm.transition(WorkflowEvent.AUDIT_GATE_PASSED);
        } else {
            fsm.transition(WorkflowEvent.AUDIT_GATE_FAILED);
        }

        assert.strictEqual(fsm.getState(), WorkflowState.EXECUTING);
    });
});
