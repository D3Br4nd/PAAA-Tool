import { libsqlClient } from "$lib/server/db";
import { uuidv7 } from "$lib/utils/uuidv7";
import type {
  loginAccessAreas,
  loginAccessMethods,
  loginAccessOutcomes,
} from "$lib/server/schema";

type LoginAccessArea = (typeof loginAccessAreas)[number];
type LoginAccessMethod = (typeof loginAccessMethods)[number];
type LoginAccessOutcome = (typeof loginAccessOutcomes)[number];

export type LoginAccessReason =
  | "invalid_credentials"
  | "unauthorized_role"
  | "password_not_configured"
  | "invalid_join_code"
  | "rate_limited"
  | "account_locked"
  | "missing_fields";

type LoginAccessEntry = {
  area: LoginAccessArea;
  method: LoginAccessMethod;
  outcome: LoginAccessOutcome;
  reason?: LoginAccessReason | null;
  subject?: string | null;
  userId?: string | null;
  teamId?: string | null;
  ipAddress: string;
  userAgent?: string | null;
};

let schemaPromise: Promise<void> | null = null;

async function applyLoginAccessSchema(): Promise<void> {
  await libsqlClient.batch(
    [
      `CREATE TABLE IF NOT EXISTS login_access_logs (
			id TEXT PRIMARY KEY NOT NULL,
			user_id TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
			team_id TEXT REFERENCES teams(id) ON DELETE SET NULL ON UPDATE CASCADE,
			area TEXT NOT NULL,
			method TEXT NOT NULL,
			outcome TEXT NOT NULL,
			reason TEXT,
			subject TEXT,
			ip_address TEXT NOT NULL,
			user_agent TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
		)`,
      "CREATE INDEX IF NOT EXISTS login_access_logs_created_at_idx ON login_access_logs(created_at)",
      "CREATE INDEX IF NOT EXISTS login_access_logs_outcome_created_at_idx ON login_access_logs(outcome, created_at)",
      "CREATE INDEX IF NOT EXISTS login_access_logs_ip_created_at_idx ON login_access_logs(ip_address, created_at)",
      "CREATE INDEX IF NOT EXISTS login_access_logs_user_idx ON login_access_logs(user_id)",
      "CREATE INDEX IF NOT EXISTS login_access_logs_team_idx ON login_access_logs(team_id)",
    ],
    "write",
  );
}

/** Keeps existing installations compatible before the first login is audited. */
export function ensureLoginAccessSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = applyLoginAccessSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function limited(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

/**
 * Audit writes are best-effort: an unavailable audit table must not turn valid
 * credentials into an outage. Failures remain visible in the server logs.
 */
export async function recordLoginAccess(
  entry: LoginAccessEntry,
): Promise<void> {
  try {
    await ensureLoginAccessSchema();
    await libsqlClient.execute({
      sql: `INSERT INTO login_access_logs (
				id, user_id, team_id, area, method, outcome, reason,
				subject, ip_address, user_agent, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuidv7(),
        entry.userId ?? null,
        entry.teamId ?? null,
        entry.area,
        entry.method,
        entry.outcome,
        entry.reason ?? null,
        limited(entry.subject, 254),
        limited(entry.ipAddress, 128) ?? "sconosciuto",
        limited(entry.userAgent, 512),
        Date.now(),
      ],
    });
  } catch (error) {
    console.error("Impossibile registrare il tentativo di accesso", error);
  }
}
