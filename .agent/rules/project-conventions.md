# 📋 Convenzioni Generali del Progetto

> Linee guida per mantenere coerenza nel codebase PAAA-Tool.

---

## ⚠️ Progetto in Evoluzione

> Siamo in fase esplorativa! Queste sono **linee guida**, non dogmi. 
> Tutto può cambiare man mano che capiamo meglio cosa serve.

### Fondamentali (da mantenere)
- ✅ **UUIDv7** per ID — già implementato, funziona bene
- ✅ **Epoch milliseconds** per timestamp — coerenza DB
- ✅ **TypeScript** — type safety aiuta sempre

### Tutto il resto è negoziabile
Naming, struttura file, pattern... si evolvono con il progetto.

---

## 🆔 Identificatori

### UUIDv7 per tutti gli ID
- **SEMPRE** usare `uuidv7()` da `$lib/utils/uuidv7.ts` per generare ID
- Mai usare `crypto.randomUUID()` o UUID v4
- UUIDv7 garantisce ordinamento temporale per performance DB

```typescript
// ✅ Corretto
import { uuidv7 } from '$lib/utils/uuidv7';
const id = uuidv7();

// ❌ Errato
const id = crypto.randomUUID();
```

---

## 📁 Struttura File

### Percorsi Import
- Usare **sempre** alias `$lib/` per import dalla libreria
- Evitare percorsi relativi complessi (`../../../`)

```typescript
// ✅ Corretto
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';

// ❌ Errato
import { db } from '../../../lib/server/db';
```

### Naming Conventions
| Tipo | Convenzione | Esempio |
|------|-------------|---------|
| File Svelte | `kebab-case.svelte` | `team-card.svelte` |
| File TypeScript | `kebab-case.ts` | `mutation-queue.ts` |
| Componenti UI | PascalCase export | `Button`, `Card` |
| Funzioni | camelCase | `enqueueMutation()` |
| Costanti | UPPER_SNAKE_CASE | `LOCAL_SCHEMA_SQL` |
| Tipi/Interfacce | PascalCase | `QueuedMutation` |
| Variabili env | UPPER_SNAKE_CASE | `DATABASE_URL` |

---

## 🕐 Timestamp

### Formato Standard
- **SEMPRE** usare epoch milliseconds (`Date.now()`)
- Drizzle: `{ mode: 'timestamp_ms' }` per colonne timestamp
- SQLite: colonne `INTEGER` per timestamp

```typescript
// ✅ Corretto
const createdAt = Date.now();

// ❌ Errato
const createdAt = new Date().toISOString();
```

---

## 📝 Documentazione

### JSDoc per funzioni pubbliche
```typescript
/**
 * Descrizione breve della funzione.
 * 
 * @param param1 - Descrizione parametro
 * @returns Descrizione del valore di ritorno
 * @throws {ErrorType} Quando può fallire
 */
export function myFunction(param1: string): ReturnType { }
```

### Commenti nel codice
- Spiegare il **perché**, non il **cosa**
- Evitare commenti ovvi

```typescript
// ✅ Corretto
// 12-bit monotonic sequence per evitare collisioni in same-ms
seq12 = (seq12 + 1) & 0x0fff;

// ❌ Errato
// Incrementa seq12
seq12++;
```

---

## 🔒 Sicurezza

### Variabili d'ambiente
- Secrets solo in `.env` (mai committare)
- Usare `$env/dynamic/private` per secrets server-side
- Usare `$env/static/public` solo per valori pubblici

```typescript
// ✅ Corretto (server-side)
import { env } from '$env/dynamic/private';
const token = env.DATABASE_AUTH_TOKEN;

// ✅ Corretto (client-side, solo valori pubblici)
import { PUBLIC_APP_URL } from '$env/static/public';
```

### SQL Injection
- In client-side SQLite: **escape sempre** i valori stringa
- Server-side: Drizzle gestisce automaticamente con prepared statements

---

## 🧪 Testing Mentality

### Anche senza test formali
- Scrivere codice testabile (funzioni pure quando possibile)
- Isolare side effects
- Preferire dependency injection

---

## 📦 Export/Import

### Barrel exports per componenti UI
```typescript
// src/lib/components/ui/button/index.ts
export { default as Button } from './button.svelte';
```

### Re-export centralizzati
```typescript
// Permette: import { Button, Card } from '$lib/components/ui';
```

---

## ⚠️ Error Handling

### Pattern standard
```typescript
try {
  await riskyOperation();
} catch (err) {
  const message = err instanceof Error 
    ? `${err.name}: ${err.message}` 
    : 'Unknown error';
  // Log o handle
}
```

---

## 💡 Cose da Tenere a Mente

- Evitare `any` quando possibile (ma va bene usarlo per prototipare velocemente)
- Non hardcodare URL in produzione — ma in dev va bene per testare
- Non committare `.env` con secrets — questo sì è importante
- `console.log` per debug va benissimo — puliremo dopo
