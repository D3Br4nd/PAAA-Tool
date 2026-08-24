# 📴 Offline-First Architecture

> Riferimento per il sistema offline-first con SQLite WASM, OPFS e mutation queue.

---

## ⚠️ Funzionalità Opzionale

> L'infrastruttura offline-first è **già predisposta** ma potrebbe non servire subito.
> Valutare se implementare in base alle esigenze reali dell'evento.

### Quando serve davvero
- 📶 Zone con scarsa copertura di rete
- 🏃 Utenti in movimento durante la caccia
- ⚡ Necessità di reattività immediata

### Quando possiamo farne a meno (per ora)
- 🌐 Se c'è buona copertura WiFi/4G
- 🎯 MVP iniziale — meglio semplice che complesso
- ⏰ Poco tempo per implementare

**L'infrastruttura è pronta, attivarla quando serve.**

---

## 🎯 Principi Fondamentali

### Local-First
1. **Write locale immediato** - L'utente vede subito il risultato
2. **Sync in background** - Quando online, sincronizza con server
3. **Conflict resolution** - Server è source of truth

### Pattern Outbox
```
User Action → Local SQLite → Mutation Queue → Background Sync → Server
                  ↓
            UI aggiornata immediatamente
```

---

## 🗃️ SQLite WASM + OPFS

### Inizializzazione
```typescript
// ✅ Usare sempre il singleton
import { getLocalDb } from '$lib/client/db/sqlite';

const db = await getLocalDb();
```

### Constraints
- **Solo browser** - OPFS non esiste in SSR
- **Origin-scoped** - Ogni subdomain ha storage separato
- **Cross-origin isolation** richiesta per performance ottimali

### Verificare ambiente browser
```typescript
function assertBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Local SQLite can only be initialized in the browser.');
  }
}
```

---

## 📥 Mutation Queue

### Struttura mutation
```typescript
type QueuedMutation = {
  id: string;          // UUIDv7
  type: string;        // es. "team.complete_challenge"
  payload: unknown;    // Dati serializzabili JSON
  createdAt: number;   // epoch ms
  status: 'pending' | 'processing' | 'done' | 'failed';
  attemptCount: number;
  lastError?: string;
  nextAttemptAt?: number;
};
```

### Accodare mutazioni
```typescript
import { enqueueMutation } from '$lib/client/sync/mutation-queue';

await enqueueMutation('team.scored', {
  teamId: '...',
  stageId: '...',
  points: 50
});
```

### Naming convention per type
```
<domain>.<action>

Esempi:
- team.created
- team.completed_challenge  
- submission.submitted
- user.logged_in
```

---

## 🔄 useOfflineMutation Hook

### Pattern standard
```typescript
import { useOfflineMutation } from '$lib/client/query/use-offline-mutation';

const completeChallengesMutation = useOfflineMutation({
  type: 'team.completed_challenge',
  
  // 1. Scrittura locale (sempre eseguita)
  applyLocal: async (variables) => {
    const db = await getLocalDb();
    db.exec(`
      INSERT INTO team_completions (...)
      VALUES (...)
    `);
  },
  
  // 2. Push al server (solo se online)
  pushRemote: async (variables) => {
    const res = await fetch('/api/challenges/complete', {
      method: 'POST',
      body: JSON.stringify(variables)
    });
    return res.json();
  },
  
  // 3. Optimistic update cache (opzionale)
  onLocalApplied: (variables, queryClient) => {
    queryClient.setQueryData(['team', variables.teamId], (old) => ({
      ...old,
      completedChallenges: [...old.completedChallenges, variables.challengeId]
    }));
  }
});
```

---

## 👷 Web Worker Sync

### Avvio worker
```typescript
// In +layout.svelte (onMount)
import { startSyncWorker } from '$lib/client/sync/sync-worker-client';

onMount(() => {
  startSyncWorker();
});
```

### Comportamento worker
1. Si attiva su evento `online`
2. Processa `mutation_queue` in ordine FIFO
3. Backoff esponenziale su errori
4. Marca mutations come `done` o `failed`

### Trigger manuale sync
```typescript
// Da sync-worker-client.ts
const poke = () => worker?.postMessage({ type: 'sync' });
poke(); // Forza drain della queue
```

---

## 🖥️ Endpoint Server per Sync

### Struttura `/api/sync`
```typescript
// src/routes/api/sync/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  const mutation = await request.json();
  
  // Routing per tipo
  switch (mutation.type) {
    case 'team.completed_challenge':
      await handleCompleteChallenge(mutation.payload);
      break;
    case 'submission.submitted':
      await handleSubmission(mutation.payload);
      break;
    default:
      return json({ error: 'Unknown mutation type' }, { status: 400 });
  }
  
  return json({ ok: true });
};
```

### Idempotenza OBBLIGATORIA
```typescript
async function handleCompleteChallenge(payload: { id: string; teamId: string; challengeId: string }) {
  // Usare l'ID della mutation o una chiave naturale per idempotenza
  const existing = await db.select()
    .from(completions)
    .where(eq(completions.id, payload.id));
  
  if (existing.length > 0) {
    return; // Già processato, skip
  }
  
  await db.insert(completions).values(payload);
}
```

---

## 📐 Schema Locale

### Tenere in sync con server
```sql
-- src/lib/client/db/local-schema.ts
-- Deve rispecchiare le tabelle server per query offline
CREATE TABLE IF NOT EXISTS teams (...);
CREATE TABLE IF NOT EXISTS challenges (...);
```

### Mutation queue sempre presente
```sql
CREATE TABLE IF NOT EXISTS mutation_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mutation_queue_status_created
  ON mutation_queue(status, created_at);
```

---

## ⚠️ Gestione Errori

### Retry con backoff
```typescript
const BACKOFF_MS = 30_000; // 30 secondi

async function markFailed(id: string, error: unknown) {
  const nextAttemptAt = Date.now() + BACKOFF_MS;
  // Update mutation_queue...
}
```

### Limite retry
```typescript
const MAX_ATTEMPTS = 5;

if (mutation.attemptCount >= MAX_ATTEMPTS) {
  // Marca come failed permanentemente
  // Notifica utente
}
```

---

## 🧪 Testing Offline

### Simulare offline
```typescript
// In browser devtools
Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
```

### Verificare queue
```typescript
const pending = await listPendingMutations();
console.log('Mutations in queue:', pending.length);
```

---

## 🚫 Anti-Pattern Offline-First

1. **Mai** assumere connettività - sempre check `navigator.onLine`
2. **Mai** bloccare UI su operazioni remote
3. **Mai** mutation senza ID univoco per idempotenza
4. **Mai** sync senza gestione conflitti
5. **Mai** payload non serializzabili in JSON (Date objects, functions, etc.)
6. **Mai** dimenticare di avviare il sync worker in layout
