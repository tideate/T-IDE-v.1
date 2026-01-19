import { VerificationReport } from '../verification/VerificationPipeline';

export enum WorkflowState {
    IDLE = 'idle',
    PLANNING = 'planning',
    AWAITING_PLAN_GATE = 'awaiting_plan_gate',
    AUDITING = 'auditing',
    AWAITING_AUDIT_GATE = 'awaiting_audit_gate',
    EXECUTING = 'executing',
    AWAITING_EXECUTION_GATE = 'awaiting_execution_gate',
    DOCUMENTING = 'documenting',
    AWAITING_DOCUMENTATION_GATE = 'awaiting_documentation_gate',
    VERIFYING = 'verifying',
    SELF_CORRECTING = 'self_correcting',
    COMPLETE = 'complete',
    FAILED = 'failed'
}

export enum WorkflowEvent {
    START_TASK = 'start_task',
    PLANNING_COMPLETE = 'planning_complete',
    PLAN_GATE_PASSED = 'plan_gate_passed',
    PLAN_GATE_FAILED = 'plan_gate_failed',
    AUDITING_COMPLETE = 'auditing_complete',
    AUDIT_GATE_PASSED = 'audit_gate_passed',
    AUDIT_GATE_FAILED = 'audit_gate_failed',
    EXECUTION_COMPLETE = 'execution_complete',
    EXECUTION_GATE_PASSED = 'execution_gate_passed',
    EXECUTION_GATE_FAILED = 'execution_gate_failed',
    DOCUMENTATION_COMPLETE = 'documentation_complete',
    DOCUMENTATION_GATE_PASSED = 'documentation_gate_passed',
    DOCUMENTATION_GATE_FAILED = 'documentation_gate_failed',
    VERIFICATION_PASSED = 'verification_passed',
    VERIFICATION_FAILED = 'verification_failed',
    CORRECTION_SUCCEEDED = 'correction_succeeded',
    CORRECTION_EXHAUSTED = 'correction_exhausted',
    RESET = 'reset'
}

export interface StateTransition {
    from: WorkflowState;
    to: WorkflowState;
    event: WorkflowEvent;
    timestamp: Date;
}

export class WorkflowFSM {
    private state: WorkflowState = WorkflowState.IDLE;
    private history: StateTransition[] = [];

    // Valid transitions map
    private readonly transitions: Map<WorkflowState, Map<WorkflowEvent, WorkflowState>> = new Map<WorkflowState, Map<WorkflowEvent, WorkflowState>>([
        [WorkflowState.IDLE, new Map([
            [WorkflowEvent.START_TASK, WorkflowState.PLANNING]
        ])],
        [WorkflowState.PLANNING, new Map([
            [WorkflowEvent.PLANNING_COMPLETE, WorkflowState.AWAITING_PLAN_GATE]
        ])],
        [WorkflowState.AWAITING_PLAN_GATE, new Map([
            [WorkflowEvent.PLAN_GATE_PASSED, WorkflowState.AUDITING],
            [WorkflowEvent.PLAN_GATE_FAILED, WorkflowState.FAILED]
        ])],
        [WorkflowState.AUDITING, new Map([
            [WorkflowEvent.AUDITING_COMPLETE, WorkflowState.AWAITING_AUDIT_GATE]
        ])],
        [WorkflowState.AWAITING_AUDIT_GATE, new Map([
            [WorkflowEvent.AUDIT_GATE_PASSED, WorkflowState.EXECUTING],
            [WorkflowEvent.AUDIT_GATE_FAILED, WorkflowState.PLANNING] // Re-plan
        ])],
        [WorkflowState.EXECUTING, new Map([
            [WorkflowEvent.EXECUTION_COMPLETE, WorkflowState.AWAITING_EXECUTION_GATE]
        ])],
        [WorkflowState.AWAITING_EXECUTION_GATE, new Map([
            [WorkflowEvent.EXECUTION_GATE_PASSED, WorkflowState.DOCUMENTING],
            [WorkflowEvent.EXECUTION_GATE_FAILED, WorkflowState.FAILED]
        ])],
        [WorkflowState.DOCUMENTING, new Map([
            [WorkflowEvent.DOCUMENTATION_COMPLETE, WorkflowState.AWAITING_DOCUMENTATION_GATE]
        ])],
        [WorkflowState.AWAITING_DOCUMENTATION_GATE, new Map([
            [WorkflowEvent.DOCUMENTATION_GATE_PASSED, WorkflowState.VERIFYING],
            [WorkflowEvent.DOCUMENTATION_GATE_FAILED, WorkflowState.FAILED]
        ])],
        [WorkflowState.VERIFYING, new Map([
            [WorkflowEvent.VERIFICATION_PASSED, WorkflowState.COMPLETE],
            [WorkflowEvent.VERIFICATION_FAILED, WorkflowState.SELF_CORRECTING]
        ])],
        [WorkflowState.SELF_CORRECTING, new Map([
            [WorkflowEvent.CORRECTION_SUCCEEDED, WorkflowState.VERIFYING],
            [WorkflowEvent.CORRECTION_EXHAUSTED, WorkflowState.FAILED]
        ])],
        [WorkflowState.COMPLETE, new Map([
            [WorkflowEvent.RESET, WorkflowState.IDLE]
        ])],
        [WorkflowState.FAILED, new Map([
            [WorkflowEvent.RESET, WorkflowState.IDLE]
        ])]
    ]);

    /**
     * Attempt a state transition
     */
    transition(event: WorkflowEvent): boolean {
        const currentTransitions = this.transitions.get(this.state);

        if (!currentTransitions) {
            console.error(`No transitions defined for state: ${this.state}`);
            return false;
        }

        const nextState = currentTransitions.get(event);

        if (!nextState) {
            console.error(`Invalid transition: ${this.state} + ${event}`);
            return false;
        }

        // Record transition
        this.history.push({
            from: this.state,
            to: nextState,
            event,
            timestamp: new Date()
        });

        console.log(`[FSM] ${this.state} → ${nextState} (${event})`);
        this.state = nextState;

        return true;
    }

    getState(): WorkflowState {
        return this.state;
    }

    getHistory(): StateTransition[] {
        return [...this.history];
    }

    canTransition(event: WorkflowEvent): boolean {
        const currentTransitions = this.transitions.get(this.state);
        return currentTransitions?.has(event) ?? false;
    }

    isTerminal(): boolean {
        return this.state === WorkflowState.COMPLETE || this.state === WorkflowState.FAILED;
    }

    isAwaitingGate(): boolean {
        return this.state === WorkflowState.AWAITING_PLAN_GATE ||
               this.state === WorkflowState.AWAITING_AUDIT_GATE ||
               this.state === WorkflowState.AWAITING_EXECUTION_GATE ||
               this.state === WorkflowState.AWAITING_DOCUMENTATION_GATE;
    }

    reset(): boolean {
        if (this.isTerminal()) {
            this.state = WorkflowState.IDLE;
            this.history = [];
            return true;
        }
        return false;
    }

    forceReset(): void {
        console.warn('Force reset triggered!');
        this.state = WorkflowState.IDLE;
        this.history = [];
    }

    serialize(): string {
        return JSON.stringify({
            state: this.state,
            history: this.history
        });
    }

    static deserialize(json: string): WorkflowFSM {
        const data = JSON.parse(json);
        const fsm = new WorkflowFSM();
        if (data.state && Object.values(WorkflowState).includes(data.state)) {
            fsm.state = data.state;
        } else {
             throw new Error('Invalid serialized state');
        }
        if (Array.isArray(data.history)) {
            fsm.history = data.history.map((h: any) => ({
                ...h,
                timestamp: new Date(h.timestamp)
            }));
        }
        return fsm;
    }
}
