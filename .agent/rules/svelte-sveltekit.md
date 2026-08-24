# 🔶 Svelte 5 & SvelteKit

> Riferimento per sviluppo frontend con Svelte 5 (runes) e SvelteKit 2.

---

## ⚠️ Fase Esplorativa

> Stiamo ancora definendo l'architettura. Questi sono **pattern di riferimento**, 
> non regole da seguire alla lettera. Sperimenta!

### Da usare sicuramente
- ✅ **Svelte 5 runes** (`$state`, `$derived`) — è la sintassi nuova
- ✅ **SvelteKit routing** — file-based, già configurato
- ✅ **TypeScript** — aiuta con l'autocompletamento

### Da definire ancora
- Struttura componenti
- Pattern di data loading
- Gestione form
- Autenticazione

---

## 🎯 Svelte 5 Runes

### Usare le Runes, non la sintassi legacy
Svelte 5 introduce le runes. **SEMPRE** preferirle alla vecchia sintassi.

```svelte
<script lang="ts">
  // ✅ Corretto - Svelte 5 runes
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  function increment() {
    count++;
  }
  
  $effect(() => {
    console.log('Count changed:', count);
  });

  // ❌ Errato - sintassi legacy
  // let count = 0; // Non reattivo in Svelte 5
  // $: doubled = count * 2; // Vecchia sintassi
</script>
```

### Runes principali
| Rune | Uso |
|------|-----|
| `$state()` | Stato reattivo |
| `$derived()` | Valori calcolati |
| `$effect()` | Side effects |
| `$props()` | Props del componente |
| `$bindable()` | Props con bind bidirezionale |

---

## 📄 Struttura Componenti

### Ordine delle sezioni
```svelte
<script lang="ts">
  // 1. Import
  import { Button } from '$lib/components/ui/button';
  
  // 2. Props
  let { title, onClick }: { title: string; onClick: () => void } = $props();
  
  // 3. State
  let isOpen = $state(false);
  
  // 4. Derived
  let label = $derived(isOpen ? 'Chiudi' : 'Apri');
  
  // 5. Effects
  $effect(() => {
    // side effects
  });
  
  // 6. Functions
  function handleClick() {
    isOpen = !isOpen;
  }
</script>

<!-- 7. Template -->
<div>
  <h1>{title}</h1>
  <Button on:click={handleClick}>{label}</Button>
</div>

<!-- 8. Styles (se non usi Tailwind) -->
<style>
  /* scoped styles */
</style>
```

---

## 🛣️ Routing SvelteKit

### File-based routing
```
src/routes/
├── +page.svelte          # /
├── +layout.svelte        # Layout root
├── login/
│   └── +page.svelte      # /login
├── teams/
│   ├── +page.svelte      # /teams
│   ├── +page.server.ts   # Load data server-side
│   └── [id]/
│       └── +page.svelte  # /teams/:id (dynamic)
└── api/
    └── sync/
        └── +server.ts    # API endpoint: POST /api/sync
```

### File conventions
| File | Scopo |
|------|-------|
| `+page.svelte` | UI della pagina |
| `+page.ts` | Load function (universal) |
| `+page.server.ts` | Load function (server-only) |
| `+layout.svelte` | Layout wrapper |
| `+layout.server.ts` | Layout data loader |
| `+server.ts` | API endpoint |
| `+error.svelte` | Error page |

---

## 📊 Data Loading

### Load Functions
```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { teams } from '$lib/server/schema';

export const load: PageServerLoad = async () => {
  const allTeams = await db.select().from(teams);
  
  return {
    teams: allTeams
  };
};
```

### Accesso ai dati in pagina
```svelte
<script lang="ts">
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
</script>

{#each data.teams as team}
  <p>{team.name}</p>
{/each}
```

---

## 🔄 Form Actions

### Pattern standard
```typescript
// +page.server.ts
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get('name');
    
    if (!name || typeof name !== 'string') {
      return fail(400, { error: 'Nome richiesto' });
    }
    
    // Salva in DB...
    
    throw redirect(303, '/teams');
  }
};
```

```svelte
<form method="POST" action="?/create">
  <input name="name" required />
  <button type="submit">Crea</button>
</form>
```

---

## 🪝 Hooks

### hooks.server.ts
```typescript
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Middleware logic qui
  // event.locals.user = await getUser(event.cookies);
  
  return resolve(event);
};
```

### Tenere hooks minimali
- Il progetto è single-tenant, no logica subdomain
- Aggiungere solo autenticazione/autorizzazione quando necessario

---

## 🧩 Componenti UI

### Usare shadcn-svelte
- Componenti già configurati in `$lib/components/ui/`
- Stili coerenti con TailwindCSS
- Accessibilità built-in

### Aggiungere nuovi componenti
```bash
# Usare la CLI shadcn-svelte
npx shadcn-svelte@latest add dialog
npx shadcn-svelte@latest add input
npx shadcn-svelte@latest add form
```

### Pattern import componenti
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
</script>
```

---

## 🖼️ Asset Statici

### Usare `/static`
```svelte
<!-- File in: static/logo.svg -->
<img src="/logo.svg" alt="Logo" />
```

### Import diretto per bundling
```svelte
<script>
  import logo from '$lib/assets/logo.svg';
</script>
<img src={logo} alt="Logo" />
```

---

## ⚡ Performance

### Lazy loading componenti pesanti
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  
  let HeavyComponent: typeof import('$lib/components/heavy.svelte').default;
  
  onMount(async () => {
    const module = await import('$lib/components/heavy.svelte');
    HeavyComponent = module.default;
  });
</script>

{#if HeavyComponent}
  <svelte:component this={HeavyComponent} />
{/if}
```

### Evitare re-render inutili
- Usare `$derived()` invece di calcoli inline nel template
- Usare `{#key}` per forzare re-mount quando necessario

---

## 🚫 Anti-Pattern Svelte

1. **Mai** mutare props direttamente
2. **Mai** usare `document.querySelector` - usare `bind:this`
3. **Mai** mix di sintassi legacy e runes nello stesso componente
4. **Mai** logica complessa nel template - estrarre in funzioni
5. **Mai** fetch in componenti - usare load functions o TanStack Query
