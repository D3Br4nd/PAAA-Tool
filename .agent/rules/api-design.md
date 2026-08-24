# 🌐 API Design

> Riferimento per progettare API endpoints in SvelteKit.

---

## ⚠️ API da Definire

> Le API **non esistono ancora**. Questo documento contiene **pattern di riferimento**
> da usare quando sarà il momento di implementarle.

### Da decidere
- Quali endpoint servono
- Struttura delle risposte
- Autenticazione
- Validazione input

### Pattern pronti all'uso (quando serviranno)
I pattern sotto sono esempi da copiare e adattare.

---

## 📁 Struttura Endpoints

### File-based API routes
```
src/routes/api/
├── auth/
│   ├── login/
│   │   └── +server.ts     # POST /api/auth/login
│   ├── logout/
│   │   └── +server.ts     # POST /api/auth/logout
│   └── register/
│       └── +server.ts     # POST /api/auth/register
├── teams/
│   ├── +server.ts         # GET /api/teams, POST /api/teams
│   └── [id]/
│       └── +server.ts     # GET/PUT/DELETE /api/teams/:id
├── stages/
│   └── +server.ts
├── submissions/
│   └── +server.ts
└── sync/
    └── +server.ts         # POST /api/sync (mutation queue drain)
```

---

## 🔧 Struttura Endpoint

### Pattern base
```typescript
// src/routes/api/teams/+server.ts
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teams } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { uuidv7 } from '$lib/utils/uuidv7';

// GET /api/teams
export const GET: RequestHandler = async ({ url }) => {
  const limit = Number(url.searchParams.get('limit')) || 50;
  
  const result = await db.select().from(teams).limit(limit);
  
  return json({ data: result });
};

// POST /api/teams
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  
  // Validazione
  if (!body.name || typeof body.name !== 'string') {
    throw error(400, { message: 'Name is required' });
  }
  
  const now = Date.now();
  const newTeam = {
    id: uuidv7(),
    name: body.name,
    joinCode: generateJoinCode(),
    leaderUserId: body.leaderUserId,
    createdAt: now,
    updatedAt: now
  };
  
  await db.insert(teams).values(newTeam);
  
  return json({ data: newTeam }, { status: 201 });
};
```

### Dynamic routes
```typescript
// src/routes/api/teams/[id]/+server.ts
import type { RequestHandler } from './$types';

// GET /api/teams/:id
export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;
  
  const team = await db.select()
    .from(teams)
    .where(eq(teams.id, id))
    .get();
  
  if (!team) {
    throw error(404, { message: 'Team not found' });
  }
  
  return json({ data: team });
};

// PUT /api/teams/:id
export const PUT: RequestHandler = async ({ params, request }) => {
  const { id } = params;
  const body = await request.json();
  
  await db.update(teams)
    .set({ ...body, updatedAt: Date.now() })
    .where(eq(teams.id, id));
  
  return json({ success: true });
};

// DELETE /api/teams/:id
export const DELETE: RequestHandler = async ({ params }) => {
  const { id } = params;
  
  await db.delete(teams).where(eq(teams.id, id));
  
  return new Response(null, { status: 204 });
};
```

---

## 📨 Response Format

### Struttura standard
```typescript
// Success con dati
{ data: T }

// Success con lista
{ data: T[], meta?: { total: number, page: number, limit: number } }

// Success senza dati
{ success: true }

// Errore
{ message: string, code?: string }
```

### HTTP Status Codes
| Code | Uso |
|------|-----|
| 200 | OK (GET, PUT) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validazione fallita) |
| 401 | Unauthorized (non autenticato) |
| 403 | Forbidden (non autorizzato) |
| 404 | Not Found |
| 409 | Conflict (duplicato) |
| 500 | Internal Server Error |

---

## ✅ Validazione Input

### Pattern validazione
```typescript
import { error } from '@sveltejs/kit';

function validateTeamInput(body: unknown): { name: string; leaderId: string } {
  if (!body || typeof body !== 'object') {
    throw error(400, { message: 'Invalid request body' });
  }
  
  const { name, leaderId } = body as Record<string, unknown>;
  
  if (!name || typeof name !== 'string' || name.length < 2) {
    throw error(400, { message: 'Name must be at least 2 characters' });
  }
  
  if (!leaderId || typeof leaderId !== 'string') {
    throw error(400, { message: 'Leader ID is required' });
  }
  
  return { name, leaderId };
}
```

### Usare librerie di validazione (opzionale)
```typescript
// Con Zod (da installare se necessario)
import { z } from 'zod';

const TeamSchema = z.object({
  name: z.string().min(2).max(100),
  leaderId: z.string().uuid()
});

const result = TeamSchema.safeParse(body);
if (!result.success) {
  throw error(400, { message: result.error.message });
}
```

---

## 🔐 Autenticazione

### Pattern con cookies
```typescript
export const POST: RequestHandler = async ({ request, cookies }) => {
  // Login
  const { email, password } = await request.json();
  const user = await verifyCredentials(email, password);
  
  const sessionId = uuidv7();
  await createSession(sessionId, user.id);
  
  cookies.set('session', sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7 // 7 giorni
  });
  
  return json({ data: { userId: user.id } });
};
```

### Proteggere endpoint
```typescript
export const GET: RequestHandler = async ({ cookies, locals }) => {
  const session = cookies.get('session');
  
  if (!session) {
    throw error(401, { message: 'Authentication required' });
  }
  
  // Oppure usare locals.user da hooks.server.ts
  if (!locals.user) {
    throw error(401, { message: 'Authentication required' });
  }
  
  // ... logica protetta
};
```

---

## 🔄 Endpoint Sync

### Per mutation queue
```typescript
// src/routes/api/sync/+server.ts
export const POST: RequestHandler = async ({ request }) => {
  const { type, payload, id } = await request.json();
  
  // Idempotenza: check se già processato
  const existing = await db.select()
    .from(processedMutations)
    .where(eq(processedMutations.id, id));
  
  if (existing.length > 0) {
    return json({ success: true, duplicate: true });
  }
  
  // Routing per tipo
  switch (type) {
    case 'team.completed_challenge':
      await handleCompleteChallenge(payload);
      break;
    case 'submission.submitted':
      await handleSubmission(payload);
      break;
    default:
      throw error(400, { message: `Unknown mutation type: ${type}` });
  }
  
  // Registra come processato
  await db.insert(processedMutations).values({
    id,
    type,
    processedAt: Date.now()
  });
  
  return json({ success: true });
};
```

---

## 📊 Paginazione

### Query params standard
```typescript
// GET /api/teams?page=1&limit=20&sort=name&order=asc

export const GET: RequestHandler = async ({ url }) => {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const offset = (page - 1) * limit;
  
  const data = await db.select()
    .from(teams)
    .limit(limit)
    .offset(offset);
  
  const [{ count }] = await db.select({ count: sql`count(*)` }).from(teams);
  
  return json({
    data,
    meta: {
      page,
      limit,
      total: Number(count),
      totalPages: Math.ceil(Number(count) / limit)
    }
  });
};
```

---

## 🚫 Anti-Pattern API

1. **Mai** esporre dati sensibili (password hash, token interni)
2. **Mai** fidarsi dell'input senza validazione
3. **Mai** query senza limit (DoS potenziale)
4. **Mai** errori con stack trace in produzione
5. **Mai** endpoint senza rate limiting (futuro)
6. **Mai** azioni distruttive su GET
7. **Mai** dimenticare idempotenza per sync endpoint
