# 🗄️ Database & Drizzle ORM

> Linee guida per gestione database server-side con Drizzle e LibSQL.

---

## ⚠️ Nota sulla Flessibilità

> **Lo schema è in evoluzione!** Durante le fasi di implementazione, tabelle e colonne cambieranno frequentemente. Le linee guida in questo documento sono **suggerimenti**, non regole rigide.

### Approccio consigliato
- 🔄 **Iterare velocemente** — Non avere paura di modificare lo schema
- 🧪 **Sperimentare** — Provare strutture diverse finché non funzionano
- 📝 **Documentare le scelte** — Commentare il perché di decisioni importanti
- 🗑️ **Eliminare senza remore** — Colonne/tabelle inutili vanno rimosse
- ⏰ **Ottimizzare dopo** — Indici e performance sono preoccupazioni successive

### Cosa NON è negoziabile
- ✅ Usare il singleton `db` (non creare nuove connessioni)
- ✅ UUIDv7 per ID primari
- ✅ Timestamps in epoch milliseconds
- ✅ Import solo server-side

---

## 🔌 Connessione Database

### Usare il singleton
```typescript
// ✅ Corretto - import dal modulo centrale
import { db } from '$lib/server/db';

// ❌ Errato - creare nuove connessioni
import { createClient } from '@libsql/client';
const client = createClient({ url: '...' }); // NO!
```

### Import esclusivamente server-side
```typescript
// ✅ Solo in file +page.server.ts, +server.ts, hooks.server.ts
import { db } from '$lib/server/db';

// ❌ Mai in +page.svelte o file client
```

---

## 📐 Schema Design

### Struttura file
- Schema in `src/lib/server/schema.ts`
- Un file unico per mantenere relazioni chiare
- Esportare tabelle, relazioni e tipi

### Convenzioni tabelle
```typescript
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const myTable = sqliteTable(
  'my_table', // snake_case per nome tabella
  {
    // Colonne
    id: text('id').primaryKey(),                    // UUIDv7 come TEXT
    name: text('name').notNull(),
    score: integer('score').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    
    // Foreign keys
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' })
  },
  // Indici (secondo argomento)
  (t) => ({
    nameUq: uniqueIndex('my_table_name_uq').on(t.name),
    userIdx: index('my_table_user_idx').on(t.userId)
  })
);
```

### Tipi di colonne SQLite
| Tipo JS | Tipo SQLite | Drizzle |
|---------|-------------|---------|
| `string` | TEXT | `text()` |
| `number` | INTEGER | `integer()` |
| `boolean` | INTEGER (0/1) | `integer({ mode: 'boolean' })` |
| `Date` (epoch ms) | INTEGER | `integer({ mode: 'timestamp_ms' })` |
| `enum` | TEXT | `text({ enum: [...] })` |
| `JSON` | TEXT | `text()` + parse manuale |

---

## 🔗 Relazioni

### Definire le relazioni (quando servono)
```typescript
import { relations } from 'drizzle-orm';

export const teamsRelations = relations(teams, ({ one, many }) => ({
  leader: one(users, {
    fields: [teams.leaderUserId],
    references: [users.id],
    relationName: 'team_leader'
  }),
  submissions: many(submissions)
}));
```

### Naming relazioni
- Usare `relationName` per relazioni multiple tra stesse tabelle
- Nomi descrittivi: `team_leader`, `submission_reviewer`

---

## 📝 Query Patterns

### Select base
```typescript
import { db } from '$lib/server/db';
import { teams } from '$lib/server/schema';
import { eq, and, desc } from 'drizzle-orm';

// Select all
const allTeams = await db.select().from(teams);

// Select con where
const team = await db.select().from(teams).where(eq(teams.id, teamId));

// Select con multiple conditions
const activeTeams = await db
  .select()
  .from(teams)
  .where(and(
    eq(teams.isActive, true),
    gt(teams.score, 100)
  ))
  .orderBy(desc(teams.score));
```

### Select con join
```typescript
import { teams, users } from '$lib/server/schema';

const teamsWithLeaders = await db
  .select({
    teamId: teams.id,
    teamName: teams.name,
    leaderEmail: users.email
  })
  .from(teams)
  .leftJoin(users, eq(teams.leaderUserId, users.id));
```

### Insert
```typescript
import { uuidv7 } from '$lib/utils/uuidv7';

const now = Date.now();
await db.insert(teams).values({
  id: uuidv7(),
  name: 'Nuovo Team',
  joinCode: generateJoinCode(),
  leaderUserId: userId,
  createdAt: now,
  updatedAt: now
});
```

### Update
```typescript
await db
  .update(teams)
  .set({ 
    score: sql`${teams.score} + 10`,
    updatedAt: Date.now()
  })
  .where(eq(teams.id, teamId));
```

### Delete
```typescript
await db.delete(teams).where(eq(teams.id, teamId));
```

---

## 🔄 Transazioni

### Usare transazioni per operazioni multiple
```typescript
await db.transaction(async (tx) => {
  await tx.insert(teams).values({ ... });
  await tx.update(users).set({ ... }).where(...);
  // Se qualcosa fallisce, tutto viene rollbackato
});
```

---

## 🏗️ Migrations

### Generare migrations
```bash
bunx drizzle-kit generate
```

### Applicare migrations
```bash
bunx drizzle-kit migrate
```

### Introspect database esistente
```bash
bunx drizzle-kit introspect
```

### drizzle.config.ts (se non esiste, crearlo)
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/server/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'http://db:8080'
  }
} satisfies Config;
```

---

## 🎯 Suggerimenti Utili

### Timestamps (consigliato per tabelle principali)
```typescript
// Non obbligatori per tabelle di lookup o join tables semplici
{
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
}
```

### Aggiornare updatedAt su ogni update
```typescript
await db.update(table).set({
  ...changes,
  updatedAt: Date.now()  // Sempre!
}).where(...);
```

### Soft delete quando appropriato
```typescript
// Invece di delete
await db.update(table).set({
  deletedAt: Date.now()
}).where(...);

// Query escludendo deleted
.where(isNull(table.deletedAt))
```

### Indici per query frequenti
- Foreign keys → sempre indicizzati
- Colonne usate in WHERE → indicizzate
- Colonne usate in ORDER BY → indicizzate

---

## 🚫 Da Evitare (quando possibile)

1. **Evitare** query in loop - preferire batch/bulk operations
2. **Evitare** SELECT * - specificare colonne quando le query sono frequenti
3. **Mai** stringhe interpolate per valori utente - usare parametri Drizzle
4. **Mai** salvare password in chiaro - usare hash (bcrypt/argon2)
5. **Evitare** over-engineering iniziale - indici e ottimizzazioni arrivano dopo
