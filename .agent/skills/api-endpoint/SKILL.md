---
name: api-endpoint
description: Come creare API endpoints in SvelteKit per il progetto PAAA-Tool
---

# Creare API Endpoints

Questa skill guida la creazione di API endpoints seguendo i pattern del progetto.

## Struttura File

Gli endpoints vanno in `src/routes/api/`:

```
src/routes/api/
├── teams/
│   ├── +server.ts         # GET /api/teams, POST /api/teams
│   └── [id]/
│       └── +server.ts     # GET/PUT/DELETE /api/teams/:id
├── users/
│   └── +server.ts
└── sync/
    └── +server.ts
```

## Template Base

```typescript
// src/routes/api/example/+server.ts
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { myTable } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { uuidv7 } from '$lib/utils/uuidv7';

// GET /api/example
export const GET: RequestHandler = async ({ url, locals }) => {
  // Opzionale: protezione autenticazione
  if (!locals.user) {
    throw error(401, { message: 'Authentication required' });
  }

  const limit = Math.min(100, Number(url.searchParams.get('limit')) || 50);
  
  const result = await db.select().from(myTable).limit(limit);
  
  return json({ data: result });
};

// POST /api/example
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, { message: 'Authentication required' });
  }

  const body = await request.json();
  
  // Validazione
  if (!body.name || typeof body.name !== 'string') {
    throw error(400, { message: 'Name is required' });
  }
  
  const now = Date.now();
  const newItem = {
    id: uuidv7(),
    name: body.name,
    createdAt: now,
    updatedAt: now
  };
  
  await db.insert(myTable).values(newItem);
  
  return json({ data: newItem }, { status: 201 });
};
```

## Endpoint con Parametro Dinamico

```typescript
// src/routes/api/example/[id]/+server.ts
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { myTable } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

// GET /api/example/:id
export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;
  
  const [item] = await db.select()
    .from(myTable)
    .where(eq(myTable.id, id));
  
  if (!item) {
    throw error(404, { message: 'Item not found' });
  }
  
  return json({ data: item });
};

// PUT /api/example/:id
export const PUT: RequestHandler = async ({ params, request }) => {
  const { id } = params;
  const body = await request.json();
  
  await db.update(myTable)
    .set({ ...body, updatedAt: Date.now() })
    .where(eq(myTable.id, id));
  
  return json({ success: true });
};

// DELETE /api/example/:id
export const DELETE: RequestHandler = async ({ params }) => {
  const { id } = params;
  
  await db.delete(myTable).where(eq(myTable.id, id));
  
  return new Response(null, { status: 204 });
};
```

## Response Format Standard

```typescript
// Success con dati
{ data: T }

// Success con lista paginata
{ 
  data: T[], 
  meta: { total: number, page: number, limit: number } 
}

// Success senza dati
{ success: true }

// Errore
{ message: string, code?: string }
```

## HTTP Status Codes

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

## Validazione Input

```typescript
function validateInput(body: unknown): { name: string; email: string } {
  if (!body || typeof body !== 'object') {
    throw error(400, { message: 'Invalid request body' });
  }
  
  const { name, email } = body as Record<string, unknown>;
  
  if (!name || typeof name !== 'string' || name.length < 2) {
    throw error(400, { message: 'Name must be at least 2 characters' });
  }
  
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw error(400, { message: 'Valid email required' });
  }
  
  return { name, email };
}
```

## Protezione Ruolo

```typescript
export const POST: RequestHandler = async ({ locals }) => {
  // Solo admin
  if (!locals.user || locals.user.role !== 'admin') {
    throw error(403, { message: 'Admin access required' });
  }
  
  // ... logica
};
```

## Paginazione

```typescript
export const GET: RequestHandler = async ({ url }) => {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const offset = (page - 1) * limit;
  
  const data = await db.select()
    .from(myTable)
    .limit(limit)
    .offset(offset);
  
  const [{ count }] = await db.select({ count: sql`count(*)` }).from(myTable);
  
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

## Checklist

- [ ] File in `src/routes/api/<resource>/+server.ts`
- [ ] Import da `$lib/server/db` e `$lib/server/schema`
- [ ] UUIDv7 per nuovi ID
- [ ] Timestamps `updatedAt` su ogni update
- [ ] Validazione input
- [ ] Response format standard `{ data }` o `{ success }`
- [ ] Error handling con `throw error(code, { message })`
