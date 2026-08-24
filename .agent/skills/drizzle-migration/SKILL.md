---
name: drizzle-migration
description: Come gestire schema database e migrations con Drizzle ORM nel progetto PAAA-Tool
---

# Gestione Database con Drizzle

Questa skill guida la modifica dello schema database e l'applicazione delle migrations.

## Schema Location

Lo schema è definito in: `src/lib/server/schema.ts`

## Aggiungere una Nuova Tabella

```typescript
// src/lib/server/schema.ts
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const myNewTable = sqliteTable(
  'my_new_table',  // snake_case per nome tabella
  {
    // ID sempre con UUIDv7
    id: text('id').primaryKey(),
    
    // Colonne
    name: text('name').notNull(),
    score: integer('score').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    
    // Timestamps in epoch ms
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    
    // Foreign key
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' })
  },
  // Indici
  (t) => ({
    nameUq: uniqueIndex('my_new_table_name_uq').on(t.name),
    userIdx: index('my_new_table_user_idx').on(t.userId)
  })
);
```

## Tipi di Colonne

| Tipo JS | Tipo SQLite | Drizzle |
|---------|-------------|---------|
| `string` | TEXT | `text()` |
| `number` | INTEGER | `integer()` |
| `boolean` | INTEGER (0/1) | `integer({ mode: 'boolean' })` |
| `Date` (epoch ms) | INTEGER | `integer({ mode: 'timestamp_ms' })` |
| `enum` | TEXT | `text({ enum: ['a', 'b'] })` |

## Generare Migration

```bash
# In locale
bunx drizzle-kit generate

# In Docker
docker compose exec app bunx drizzle-kit generate
```

## Applicare Migration

```bash
# In locale
bunx drizzle-kit migrate

# In Docker
docker compose exec app bunx drizzle-kit migrate
```

## Push Diretto (Dev)

Per sviluppo rapido senza migration files:

```bash
# In Docker (metodo consigliato in questo progetto)
docker compose exec app bunx drizzle-kit push
```

> **Nota**: Il container app esegue automaticamente `drizzle-kit push` all'avvio.

## Query Patterns

### Insert con UUIDv7

```typescript
import { db } from '$lib/server/db';
import { myNewTable } from '$lib/server/schema';
import { uuidv7 } from '$lib/utils/uuidv7';

const now = Date.now();
await db.insert(myNewTable).values({
  id: uuidv7(),
  name: 'Test',
  createdAt: now,
  updatedAt: now
});
```

### Update con updatedAt

```typescript
import { eq } from 'drizzle-orm';

await db.update(myNewTable)
  .set({ 
    name: 'New Name',
    updatedAt: Date.now()  // Sempre aggiornare!
  })
  .where(eq(myNewTable.id, id));
```

### Select con Join

```typescript
const result = await db
  .select({
    id: myNewTable.id,
    name: myNewTable.name,
    userName: users.name
  })
  .from(myNewTable)
  .leftJoin(users, eq(myNewTable.userId, users.id));
```

## Relazioni (Opzionali)

```typescript
import { relations } from 'drizzle-orm';

export const myNewTableRelations = relations(myNewTable, ({ one }) => ({
  user: one(users, {
    fields: [myNewTable.userId],
    references: [users.id]
  })
}));
```

## Convenzioni Obbligatorie

- ✅ **UUIDv7** per tutti gli ID (`uuidv7()` da `$lib/utils/uuidv7`)
- ✅ **Timestamps** in epoch milliseconds (`Date.now()`)
- ✅ **Import** solo in file server (`+page.server.ts`, `+server.ts`)
- ✅ **Singleton** `db` da `$lib/server/db`

## Checklist

- [ ] Tabella aggiunta a `src/lib/server/schema.ts`
- [ ] ID come `text('id').primaryKey()` con UUIDv7
- [ ] Timestamps `createdAt` e `updatedAt` in epoch ms
- [ ] Indici per foreign keys e colonne frequenti in WHERE
- [ ] Push/migrate eseguito
