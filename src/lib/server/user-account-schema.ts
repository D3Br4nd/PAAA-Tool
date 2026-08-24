import { libsqlClient } from "$lib/server/db";

let schemaPromise: Promise<void> | null = null;

async function migrateUserAccounts(): Promise<void> {
  const info = await libsqlClient.execute("PRAGMA table_info(users)");
  const hasUsername = info.rows.some((row) => row.name === "username");

  if (!hasUsername) {
    await libsqlClient.execute("ALTER TABLE users ADD COLUMN username TEXT");
  }

  await libsqlClient.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq ON users(username COLLATE NOCASE)",
  );
}

/**
 * Keeps existing installations compatible with player usernames before any
 * Drizzle query selects the newly added column.
 */
export function ensureUserAccountSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = migrateUserAccounts().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}
