/**
 * Background worker to drain the mutation queue when online.
 *
 * This is a scaffold: wire the POST target to your SvelteKit endpoint, and make
 * the server idempotent. The worker runs in the browser, so it can access OPFS.
 */

import { listPendingMutations, markDone, markFailed, markProcessing } from '$lib/client/sync/mutation-queue';

type SyncMessage = { type: 'sync' };

async function pushToServer(mutation: { type: string; payload: unknown }) {
  // NOT WIRED UP: startSyncWorker() is commented out in +layout.svelte and
  // /api/sync does not exist. Before enabling either, note that `type` and
  // `payload` are entirely client-controlled — this queue lives in the user's
  // own browser and anyone can write to it.
  //
  // A generic "apply this mutation" endpoint would hand the client a way to
  // name its own write operation, which is the most dangerous shape an API can
  // take. Whatever /api/sync ends up doing MUST:
  //   - accept only an explicit allowlist of `type` values, never dispatch by
  //     name into a table/handler map;
  //   - re-run the same authorisation the online path runs (ownership of the
  //     team, faction scoping for staff, authMethod checks) — the queue proves
  //     nothing about who enqueued the entry;
  //   - never accept a points/score value from the payload, only recompute it
  //     server-side;
  //   - be idempotent on the mutation id, since the worker retries.
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sync failed (${res.status}): ${text}`);
  }
}

async function drainOnce() {
  // If offline, do nothing.
  // Note: `navigator.onLine` exists in workers in modern browsers, but guard anyway.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const pending = await listPendingMutations(50);
  for (const m of pending) {
    try {
      await markProcessing(m.id);
      await pushToServer({ type: m.type, payload: m.payload });
      await markDone(m.id);
    } catch (err) {
      // Network hiccup: backoff and stop this drain cycle quickly.
      await markFailed(m.id, err);
      break;
    }
  }
}

self.addEventListener('message', (e: MessageEvent<SyncMessage>) => {
  if (e.data?.type === 'sync') {
    void drainOnce();
  }
});


