/**
 * Starts a background worker that drains the local mutation queue when online.
 *
 * Call from a top-level client-only place, e.g. `+layout.svelte` onMount.
 */

let worker: Worker | null = null;

export function startSyncWorker() {
  if (typeof window === 'undefined') return;
  if (worker) return;

  worker = new Worker(new URL('$lib/workers/sync.worker.ts', import.meta.url), { type: 'module' });

  const poke = () => worker?.postMessage({ type: 'sync' });

  window.addEventListener('online', poke);
  // Kick once on boot.
  poke();
}


