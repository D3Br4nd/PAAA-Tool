---
name: shadcn-component
description: Come aggiungere e usare componenti shadcn-svelte nel progetto PAAA-Tool
---

# Componenti shadcn-svelte

Questa skill guida l'aggiunta e l'uso di componenti UI shadcn-svelte.

## Componenti Già Disponibili

Il progetto ha già installato:
- **Button** - `$lib/components/ui/button`
- **Card** - `$lib/components/ui/card`

## Aggiungere Nuovi Componenti

```bash
# Sintassi
npx shadcn-svelte@latest add <component-name>

# Esempi
npx shadcn-svelte@latest add input
npx shadcn-svelte@latest add dialog
npx shadcn-svelte@latest add dropdown-menu
npx shadcn-svelte@latest add form
npx shadcn-svelte@latest add table
npx shadcn-svelte@latest add tabs
npx shadcn-svelte@latest add toast
```

I componenti vengono installati in `src/lib/components/ui/<nome>/`.

## Import Pattern

```svelte
<script lang="ts">
  // Button
  import { Button } from '$lib/components/ui/button';
  
  // Card (multiple exports)
  import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
  } from '$lib/components/ui/card';
  
  // Dialog
  import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
  } from '$lib/components/ui/dialog';
  
  // Input
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
</script>
```

## Uso Button

```svelte
<!-- Varianti -->
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>

<!-- Dimensioni -->
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Rocket class="h-4 w-4" /></Button>

<!-- Con icona -->
<Button>
  <Rocket class="mr-2 h-4 w-4" />
  Avvia
</Button>

<!-- Disabled / Loading -->
<Button disabled>Disabled</Button>
```

## Uso Card

```svelte
<Card class="w-[350px]">
  <CardHeader>
    <CardTitle>Titolo Card</CardTitle>
    <CardDescription>Descrizione opzionale</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Contenuto della card</p>
  </CardContent>
  <CardFooter class="flex justify-between">
    <Button variant="outline">Annulla</Button>
    <Button>Conferma</Button>
  </CardFooter>
</Card>
```

## Uso Dialog

```svelte
<script lang="ts">
  let open = $state(false);
</script>

<Dialog bind:open>
  <DialogTrigger asChild let:builder>
    <Button builders={[builder]}>Apri Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titolo</DialogTitle>
      <DialogDescription>
        Descrizione del dialog.
      </DialogDescription>
    </DialogHeader>
    <div class="py-4">
      <!-- Contenuto -->
    </div>
    <DialogFooter>
      <Button variant="outline" on:click={() => open = false}>
        Annulla
      </Button>
      <Button on:click={() => { /* azione */ open = false; }}>
        Conferma
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Uso Input con Label

```svelte
<div class="grid gap-2">
  <Label for="email">Email</Label>
  <Input 
    id="email" 
    type="email" 
    placeholder="nome@esempio.com" 
    bind:value={email}
  />
</div>
```

## Icone con Lucide

```svelte
<script lang="ts">
  import { 
    Rocket, Star, User, Settings, 
    Plus, Trash2, Edit, Search,
    ChevronDown, ChevronRight,
    Check, X, AlertCircle
  } from 'lucide-svelte';
</script>

<!-- Uso base -->
<Rocket class="h-4 w-4" />

<!-- Con colore -->
<Star class="h-5 w-5 text-fuchsia-400" />

<!-- In button -->
<Button size="icon" variant="ghost">
  <Settings class="h-4 w-4" />
</Button>
```

## Customizzazione con Tailwind

I componenti accettano `class` per override:

```svelte
<Button class="bg-linear-to-r from-violet-500 to-fuchsia-500">
  Gradient Button
</Button>

<Card class="border-violet-500/50 bg-slate-900/80 backdrop-blur">
  <!-- Glassmorphism card -->
</Card>
```

## Dark Mode

Il progetto usa dark mode di default. I componenti sono già configurati per funzionare con il tema dark.

## Lista Componenti Utili

| Componente | Uso |
|------------|-----|
| `input` | Campi di testo |
| `label` | Label per form |
| `dialog` | Modal/popup |
| `dropdown-menu` | Menu dropdown |
| `select` | Select dropdown |
| `checkbox` | Checkbox |
| `switch` | Toggle switch |
| `tabs` | Navigazione tab |
| `table` | Tabelle dati |
| `toast` | Notifiche |
| `form` | Form validation |
| `avatar` | Immagini profilo |
| `badge` | Badge/tag |
| `progress` | Progress bar |
| `skeleton` | Loading placeholder |

## Checklist

- [ ] Componente installato con `npx shadcn-svelte@latest add`
- [ ] Import da `$lib/components/ui/<nome>`
- [ ] Props e varianti corrette
- [ ] Icone da `lucide-svelte`
- [ ] Customizzazione con classi Tailwind
