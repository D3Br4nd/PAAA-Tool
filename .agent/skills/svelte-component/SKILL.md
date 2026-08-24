---
name: svelte-component
description: Come creare componenti Svelte 5 seguendo le convenzioni del progetto PAAA-Tool
---

# Creare Componenti Svelte 5

Questa skill guida la creazione di componenti Svelte 5 con runes, seguendo le convenzioni del progetto.

## Struttura File

I componenti vanno in `src/lib/components/` con:
- **Componenti UI riutilizzabili**: `src/lib/components/ui/<nome>/`
- **Componenti di pagina**: direttamente nella route o in `src/lib/components/`

## Template Componente

```svelte
<script lang="ts">
  // 1. Import
  import { Button } from '$lib/components/ui/button';
  import { Rocket } from 'lucide-svelte';
  
  // 2. Props con $props()
  let { 
    title, 
    onClick,
    variant = 'default' 
  }: { 
    title: string; 
    onClick?: () => void;
    variant?: 'default' | 'secondary';
  } = $props();
  
  // 3. State con $state()
  let isOpen = $state(false);
  let count = $state(0);
  
  // 4. Derived con $derived()
  let label = $derived(isOpen ? 'Chiudi' : 'Apri');
  let doubled = $derived(count * 2);
  
  // 5. Effects con $effect()
  $effect(() => {
    console.log('Count changed:', count);
  });
  
  // 6. Functions
  function handleClick() {
    isOpen = !isOpen;
    onClick?.();
  }
</script>

<!-- 7. Template -->
<div class="rounded-lg border border-slate-700 bg-slate-900 p-4">
  <h2 class="text-lg font-semibold text-slate-100">{title}</h2>
  
  <Button on:click={handleClick}>
    <Rocket class="mr-2 h-4 w-4" />
    {label}
  </Button>
  
  {#if isOpen}
    <p class="mt-2 text-slate-300">Contenuto visibile</p>
  {/if}
</div>
```

## Runes da Usare

| Rune | Uso | Esempio |
|------|-----|---------|
| `$state()` | Stato reattivo | `let count = $state(0);` |
| `$derived()` | Valori calcolati | `let doubled = $derived(count * 2);` |
| `$effect()` | Side effects | `$effect(() => { ... });` |
| `$props()` | Props componente | `let { title } = $props();` |
| `$bindable()` | Props bidirezionali | `let { value = $bindable() } = $props();` |

## ❌ Da Evitare (Sintassi Legacy)

```svelte
<!-- NON usare la vecchia sintassi -->
<script>
  let count = 0;           // ❌ Non reattivo
  $: doubled = count * 2;  // ❌ Vecchio reactive statement
</script>
```

## Import Standard

```typescript
// Componenti UI
import { Button } from '$lib/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';

// Icone
import { Rocket, Star, User, Settings } from 'lucide-svelte';

// Utilities
import { cn } from '$lib/utils/cn';
```

## Styling con TailwindCSS

Usare **sempre** classi Tailwind, mai inline styles:

```svelte
<!-- ✅ Corretto -->
<div class="rounded-lg bg-slate-900 p-4 hover:bg-slate-800 transition-colors">

<!-- ❌ Errato -->
<div style="background: #1e293b; padding: 16px;">
```

### Palette Colori

- **Background**: `slate-950`, `slate-900`, `slate-800`
- **Testo**: `slate-100` (primario), `slate-300` (body), `slate-400` (muted)
- **Accent**: `violet-200/300/400`, `fuchsia-200/300/400`, `sky-200/300/400`

## Barrel Export

Se crei un nuovo componente riutilizzabile:

```typescript
// src/lib/components/ui/my-component/index.ts
export { default as MyComponent } from './my-component.svelte';
```

## Checklist Finale

- [ ] Usa `$state()`, `$derived()`, `$props()` (non sintassi legacy)
- [ ] TypeScript con tipi per props
- [ ] Classi Tailwind per styling
- [ ] Import da `$lib/` (non percorsi relativi)
- [ ] Nomi file in `kebab-case.svelte`
