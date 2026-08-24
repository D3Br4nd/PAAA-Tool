/**
 * SQLite WASM + OPFS initialization (no raw IndexedDB).
 *
 * Package: @sqlite.org/sqlite-wasm
 * Docs: https://sqlite.org/wasm/
 *
 * Important constraints:
 * - This MUST run in the browser (OPFS is a browser feature).
 * - OPFS is origin-scoped. Because tenants are subdomains, each tenant gets
 *   its own isolated OPFS storage automatically (good for multi-tenant).
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { LOCAL_SCHEMA_SQL } from './local-schema';

export type LocalSqliteDb = {
  /** Executes one or more SQL statements. */
  exec: (sql: string, options?: unknown) => void;
  /** Closes the DB. */
  close: () => void;
};

let sqlite3Promise: Promise<any> | null = null;
let dbPromise: Promise<LocalSqliteDb> | null = null;

function assertBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Local SQLite (OPFS) can only be initialized in the browser.');
  }
}

/**
 * Derives a stable tenant key from the current hostname.
 * Example: tenant1.event-app.com -> tenant1
 */
export function getTenantFromHostname(hostname = window.location.hostname): string {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 3) return 'default'; // e.g. localhost or apex domain
  return parts[0].toLowerCase();
}

async function getSqlite3() {
  assertBrowser();
  if (!sqlite3Promise) {
    sqlite3Promise = (sqlite3InitModule as any)({
      print: () => { },
      printErr: (msg: unknown) => console.error('[sqlite-wasm]', msg)
    });
  }
  return sqlite3Promise;
}

/**
 * Returns a singleton DB handle for the current tenant (per browser tab).
 * This is NOT a global "Drizzle client"; it’s a local embedded DB handle.
 */
export async function getLocalDb(): Promise<LocalSqliteDb> {
  assertBrowser();
  if (!dbPromise) {
    dbPromise = (async () => {
      const sqlite3 = await getSqlite3();

      // sqlite3.oo1.OpfsDb is the "batteries included" OPFS-backed database.
      const OpfsDb = sqlite3?.oo1?.OpfsDb;
      if (!OpfsDb) {
        throw new Error(
          'OPFS VFS is not available in this browser/environment. ' +
          'Ensure cross-origin isolation requirements are met per sqlite-wasm docs.'
        );
      }

      const tenant = getTenantFromHostname();
      const filename = `treasure.${tenant}.sqlite3`;

      const db = new OpfsDb(filename);
      db.exec(LOCAL_SCHEMA_SQL);

      return {
        exec: (sql: string, options?: unknown) => db.exec(sql, options as any),
        close: () => db.close()
      };
    })();
  }
  return dbPromise;
}


