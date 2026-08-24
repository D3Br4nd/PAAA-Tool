import { getLocalDb } from '$lib/client/db/sqlite';
import { uuidv7 } from '$lib/utils/uuidv7';

export type QueueStatus = 'pending' | 'processing' | 'done' | 'failed';

export type QueuedMutation<TPayload = unknown> = {
  id: string;
  type: string;
  payload: TPayload;
  createdAt: number;
  status: QueueStatus;
  attemptCount: number;
  lastError?: string | null;
  nextAttemptAt?: number | null;
};

function now() {
  return Date.now();
}

function escapeSqlString(value: string) {
  // Minimal SQL string escaping for this scaffold.
  return value.replace(/'/g, "''");
}

export async function enqueueMutation(type: string, payload: unknown): Promise<QueuedMutation> {
  const db = await getLocalDb();
  const id = uuidv7();
  const createdAt = now();
  const payloadJson = JSON.stringify(payload);

  db.exec(`
    INSERT INTO mutation_queue (id, type, payload_json, created_at, status, attempt_count)
    VALUES (
      '${escapeSqlString(id)}',
      '${escapeSqlString(type)}',
      '${escapeSqlString(payloadJson)}',
      ${createdAt},
      'pending',
      0
    );
  `);

  return {
    id,
    type,
    payload,
    createdAt,
    status: 'pending',
    attemptCount: 0,
    lastError: null,
    nextAttemptAt: null
  };
}

/**
 * NOTE: This uses sqlite-wasm's `exec` callback mode to read rows.
 * We keep it simple and dependency-free. You can replace with a typed
 * query wrapper later.
 */
export async function listPendingMutations(limit = 50): Promise<QueuedMutation[]> {
  const db = await getLocalDb();
  const rows: Array<Record<string, unknown>> = [];

  db.exec(
    `
    SELECT id, type, payload_json, created_at, status, attempt_count, last_error, next_attempt_at
    FROM mutation_queue
    WHERE status IN ('pending','failed')
      AND (next_attempt_at IS NULL OR next_attempt_at <= ${now()})
    ORDER BY created_at ASC
    LIMIT ${limit};
  `,
    {
      returnValue: 'resultRows',
      rowMode: 'object',
      callback: (row: Record<string, unknown>) => rows.push(row)
    } as any
  );

  return rows.map((r) => ({
    id: String(r.id),
    type: String(r.type),
    payload: JSON.parse(String(r.payload_json)),
    createdAt: Number(r.created_at),
    status: r.status as QueueStatus,
    attemptCount: Number(r.attempt_count),
    lastError: (r.last_error as string | null) ?? null,
    nextAttemptAt: (r.next_attempt_at as number | null) ?? null
  }));
}

export async function markProcessing(id: string): Promise<void> {
  const db = await getLocalDb();
  db.exec(`
    UPDATE mutation_queue
    SET status = 'processing'
    WHERE id = '${escapeSqlString(id)}';
  `);
}

export async function markDone(id: string): Promise<void> {
  const db = await getLocalDb();
  db.exec(`
    UPDATE mutation_queue
    SET status = 'done', last_error = NULL
    WHERE id = '${escapeSqlString(id)}';
  `);
}

export async function markFailed(id: string, error: unknown, backoffMs = 30_000): Promise<void> {
  const db = await getLocalDb();
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : typeof error === 'string' ? error : 'Unknown error';
  const nextAttemptAt = now() + backoffMs;

  db.exec(`
    UPDATE mutation_queue
    SET status = 'failed',
        attempt_count = attempt_count + 1,
        last_error = '${escapeSqlString(message)}',
        next_attempt_at = ${nextAttemptAt}
    WHERE id = '${escapeSqlString(id)}';
  `);
}


