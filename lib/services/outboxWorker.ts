import { getDb } from '../db';

export interface OutboxEventRecord {
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: any;
  idempotency_key: string;
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'RETRY' | 'DEAD_LETTER';
  attempt_count: number;
  available_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  last_error: string | null;
  delivered_at: string | null;
  correlation_id: string;
  causation_id: string | null;
  created_at: string;
}

const PROCESSED_KEYS = new Set<string>();

export async function processOutboxEvents(workerId: string = 'worker-node-1'): Promise<number> {
  const db = await getDb();

  await db.exec('BEGIN;');

  try {
    // 1. Claim pending/retryable events using FOR UPDATE SKIP LOCKED
    const claimQuery = `
      SELECT event_id, idempotency_key, event_type, payload, attempt_count, correlation_id
      FROM outbox_events
      WHERE status IN ('PENDING', 'RETRY')
        AND available_at <= NOW()
      ORDER BY created_at ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED;
    `;

    const res = await db.query<any>(claimQuery);

    if (res.rows.length === 0) {
      await db.exec('COMMIT;');
      return 0;
    }

    const claimedIds = res.rows.map((r) => r.event_id);

    // Update status to PROCESSING and set claimed metadata
    await db.query(
      `UPDATE outbox_events
       SET status = 'PROCESSING', claimed_at = NOW(), claimed_by = $1
       WHERE event_id = ANY($2::uuid[]);`,
      [workerId, claimedIds]
    );

    await db.exec('COMMIT;');

    // 2. Process events outside lock transaction
    let processedCount = 0;

    for (const row of res.rows) {
      const key = row.idempotency_key;

      try {
        // Effective-Once Check: Prevent duplicate side effect execution
        if (!PROCESSED_KEYS.has(key)) {
          PROCESSED_KEYS.add(key);

          // Execute side-effect integrations (IAM / Payroll / ERP)
          if (row.event_type === 'EMPLOYMENT_TERMINATED') {
            // Integration: Revoke IAM Credentials & Pause Payroll
          }
        }

        // Mark DELIVERED
        await db.query(
          `UPDATE outbox_events
           SET status = 'DELIVERED', delivered_at = NOW(), attempt_count = attempt_count + 1
           WHERE event_id = $1;`,
          [row.event_id]
        );
        processedCount++;
      } catch (err: any) {
        // Retry logic with backoff or Dead Letter
        const nextAttempt = row.attempt_count + 1;
        const newStatus = nextAttempt >= 5 ? 'DEAD_LETTER' : 'RETRY';

        await db.query(
          `UPDATE outbox_events
           SET status = $1, attempt_count = $2, last_error = $3, available_at = NOW() + INTERVAL '5 seconds'
           WHERE event_id = $4;`,
          [newStatus, nextAttempt, err.message, row.event_id]
        );
      }
    }

    return processedCount;
  } catch (err) {
    await db.exec('ROLLBACK;').catch(() => {});
    throw err;
  }
}
