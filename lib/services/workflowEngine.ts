import { getDb } from '../db';

export interface WorkflowPolicy {
  policy_id?: string;
  name: string;
  trigger_event: 'LEAVE_REQUEST' | 'PROMOTION' | 'EXPENSE_CLAIM' | 'ASSET_REQUEST';
  conditions: {
    min_days?: number;
    min_comp_increase_pct?: number;
    min_amount?: number;
  };
  approval_graph: string[]; // e.g. ['MANAGER', 'DEPT_HEAD', 'FINANCE_HEAD', 'HR_ADMIN']
}

export interface WorkflowInstance {
  instance_id: string;
  policy_id: string;
  requester_id: string;
  target_person_id?: string;
  current_step: number;
  status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
  payload: any;
  decisions: Array<{ step: number; approver_role: string; decision: 'APPROVED' | 'REJECTED'; timestamp: string }>;
}

export async function evaluateAndCreateWorkflow(
  triggerEvent: WorkflowPolicy['trigger_event'],
  requesterId: string,
  targetPersonId: string,
  payload: any
): Promise<{ instanceId: string; approvalGraph: string[]; status: string }> {
  const db = await getDb();

  // Define default enterprise policy rules
  let approvalGraph = ['MANAGER'];
  if (triggerEvent === 'PROMOTION' || (payload.compIncreasePct && payload.compIncreasePct > 15)) {
    approvalGraph = ['MANAGER', 'DEPT_HEAD', 'HR_ADMIN'];
  } else if (triggerEvent === 'EXPENSE_CLAIM' && payload.amount > 50000) {
    approvalGraph = ['MANAGER', 'FINANCE_HEAD'];
  } else if (triggerEvent === 'LEAVE_REQUEST' && payload.days > 5) {
    approvalGraph = ['MANAGER', 'HR_ADMIN'];
  } else if (triggerEvent === 'ASSET_REQUEST') {
    approvalGraph = ['MANAGER', 'IT_ADMIN'];
  }

  // Create Policy Record
  const polRes = await db.query<{ policy_id: string }>(
    `INSERT INTO workflow_policies (name, trigger_event, conditions, approval_graph)
     VALUES ($1, $2, $3, $4) RETURNING policy_id;`,
    [`Policy for ${triggerEvent}`, triggerEvent, JSON.stringify(payload), JSON.stringify(approvalGraph)]
  );
  const policyId = polRes.rows[0].policy_id;

  // Create Instance
  const instRes = await db.query<{ instance_id: string }>(
    `INSERT INTO workflow_instances (policy_id, requester_id, target_person_id, current_step, status, payload)
     VALUES ($1, $2, $3, 0, 'IN_PROGRESS', $4) RETURNING instance_id;`,
    [policyId, requesterId, targetPersonId, JSON.stringify(payload)]
  );

  return {
    instanceId: instRes.rows[0].instance_id,
    approvalGraph,
    status: 'IN_PROGRESS',
  };
}

export async function submitWorkflowDecision(
  instanceId: string,
  approverRole: string,
  decision: 'APPROVED' | 'REJECTED'
): Promise<{ status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED'; nextStep: number }> {
  const db = await getDb();

  const instRes = await db.query<any>(`SELECT * FROM workflow_instances WHERE instance_id = $1;`, [instanceId]);
  if (instRes.rows.length === 0) throw new Error('Workflow instance not found');

  const inst = instRes.rows[0];
  const polRes = await db.query<any>(`SELECT * FROM workflow_policies WHERE policy_id = $1;`, [inst.policy_id]);
  const policy = polRes.rows[0];

  const graph: string[] = typeof policy.approval_graph === 'string' ? JSON.parse(policy.approval_graph) : policy.approval_graph;
  const currentDecisions: any[] = typeof inst.decisions === 'string' ? JSON.parse(inst.decisions) : inst.decisions;

  currentDecisions.push({
    step: inst.current_step,
    approver_role: approverRole,
    decision,
    timestamp: new Date().toISOString(),
  });

  if (decision === 'REJECTED') {
    await db.query(
      `UPDATE workflow_instances SET status = 'REJECTED', decisions = $1 WHERE instance_id = $2;`,
      [JSON.stringify(currentDecisions), instanceId]
    );
    return { status: 'REJECTED', nextStep: inst.current_step };
  }

  const nextStep = inst.current_step + 1;
  const isFullyApproved = nextStep >= graph.length;
  const newStatus = isFullyApproved ? 'APPROVED' : 'IN_PROGRESS';

  await db.query(
    `UPDATE workflow_instances SET current_step = $1, status = $2, decisions = $3 WHERE instance_id = $4;`,
    [nextStep, newStatus, JSON.stringify(currentDecisions), instanceId]
  );

  // If fully approved, trigger kernel mutation and outbox event!
  if (isFullyApproved) {
    const payload = typeof inst.payload === 'string' ? JSON.parse(inst.payload) : inst.payload;
    await db.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, idempotency_key)
       VALUES ('PERSON', $1, $2, $3, $4)
       ON CONFLICT (idempotency_key) DO NOTHING;`,
      [inst.target_person_id, `WORKFLOW_APPROVED_${policy.trigger_event}`, JSON.stringify(payload), `idem-wf-${instanceId}`]
    );
  }

  return { status: newStatus, nextStep };
}
