# 🎨 Styling & UI Design

> Riferimento per lo stile visivo usando TailwindCSS v4 e shadcn-svelte.

---

## ⚠️ Design in Evoluzione

> Il look "cosmic / Ad Astra" della home è un **punto di partenza**, non definitivo.
> Colori, layout e componenti possono cambiare in base al feedback.

### Cosa è già impostato
- ✅ **TailwindCSS v4** — configurato e funzionante
- ✅ **shadcn-svelte** — Button e Card pronti
- ✅ **Lucide icons** — libreria icone
- ✅ **Dark mode** — default attuale

### Cosa può cambiare
- Palette colori
- Stile componenti
- Layout pagine
- Animazioni

---

## 🌙 Theme: Dark Mode First

Il progetto usa theme **dark mode** come default (stile "cosmic / Ad Astra").

```css
/* src/app.css */
:root {
  color-scheme: dark;
}
```

---

## 🎨 Palette Colori

### Colori Base (Slate)
```
slate-950  → Background principale
slate-900  → Card background
slate-800  → Borders subtle
slate-700  → Borders
slate-500  → Testo secondario
slate-400  → Testo muted
slate-300  → Testo body
slate-200  → Testo emphasis
slate-100  → Testo primario
```

### Colori Accent
```
violet-200/300/400  → Primary accent
fuchsia-200/300/400 → Secondary accent
sky-200/300/400     → Tertiary accent
indigo-300/400      → Quaternary
pink-300/400        → Highlight
```

### Gradienti Standard
```html
<!-- Hero text gradient -->
<span class="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-clip-text text-transparent">

<!-- Progress bar gradient -->
<div class="bg-gradient-to-r from-fuchsia-400 to-sky-400">

<!-- Cosmic glow background -->
<div class="bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.35)_0,transparent_45%)]">
```

---

## 🌟 Effetti Visivi

### Background Stars
```html
<!-- Stelle piccole -->
<div class="pointer-events-none absolute inset-0 opacity-15 mix-blend-screen 
     bg-[radial-gradient(rgba(255,255,255,0.85)_1px,transparent_1px)] 
     [background-size:24px_24px]">
</div>

<!-- Stelle grandi -->
<div class="pointer-events-none absolute inset-0 opacity-10 mix-blend-screen 
     bg-[radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] 
     [background-size:70px_70px]">
</div>
```

### Glassmorphism
```html
<div class="border border-white/10 bg-white/5 backdrop-blur-sm 
     shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
```

---

## 📦 Componenti UI

### Usare shadcn-svelte
```bash
# Aggiungere nuovi componenti
npx shadcn-svelte@latest add input
npx shadcn-svelte@latest add dialog
npx shadcn-svelte@latest add dropdown-menu
```

### Import pattern
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { 
    Card, 
    CardHeader, 
    CardTitle, 
    CardDescription,
    CardContent, 
    CardFooter 
  } from '$lib/components/ui/card';
</script>
```

### Varianti Button
```svelte
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
```

---

## 🔤 Icone

### Usare Lucide
```svelte
<script lang="ts">
  import { Rocket, Map, Star, Compass, User, Settings } from 'lucide-svelte';
</script>

<Rocket class="h-4 w-4" />
<Rocket class="h-5 w-5 text-fuchsia-200" />
```

### Convenzioni dimensioni
| Contesto | Classe |
|----------|--------|
| Inline con testo | `h-4 w-4` |
| In button | `h-4 w-4` |
| Card icon | `h-5 w-5` |
| Hero icon | `h-6 w-6` o `h-8 w-8` |

---

## 📐 Layout

### Container standard
```html
<div class="mx-auto max-w-6xl px-6 py-14 sm:py-20">
```

### Grid responsive
```html
<!-- 1 col mobile, 2 tablet, 3 desktop -->
<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
```

### Flexbox patterns
```html
<!-- Center both axes -->
<div class="flex items-center justify-center">

<!-- Space between -->
<div class="flex items-center justify-between">

<!-- Stack vertical mobile, row desktop -->
<div class="flex flex-col sm:flex-row items-center gap-3">
```

---

## 📱 Responsive Design

### Breakpoints (Tailwind default)
| Prefix | Min-width |
|--------|-----------|
| (none) | 0px |
| `sm:` | 640px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

### Mobile-first approach
```html
<!-- Base mobile, poi modifiche per schermi più grandi -->
<h1 class="text-4xl sm:text-6xl">
<div class="px-4 sm:px-6 lg:px-8">
```

---

## ✨ Animazioni

### Transizioni standard
```html
<button class="transition-colors hover:bg-slate-800">
<div class="transition-all duration-300 ease-out">
```

### Hover effects
```html
<!-- Lighten on hover -->
<div class="bg-slate-900 hover:bg-slate-800">

<!-- Scale on hover -->
<button class="transition-transform hover:scale-105">

<!-- Glow on hover -->
<div class="hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
```

---

## 🏷️ Typography

### Font stack (system)
Il progetto usa i font di sistema per performance. Se necessario, aggiungere Google Fonts:

```html
<!-- In app.html -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Classi tipografiche
```html
<h1 class="text-4xl font-extrabold tracking-tight sm:text-6xl">
<h2 class="text-2xl font-bold">
<p class="text-base leading-relaxed text-slate-300">
<span class="text-xs text-slate-400">
<span class="text-sm font-semibold">
```

### Text utilities
```html
<p class="text-pretty">   <!-- Migliora wrapping -->
<h1 class="text-balance"> <!-- Bilanciamento righe -->
<p class="truncate">      <!-- Tronca con ellipsis -->
```

---

## 🚫 Anti-Pattern UI

1. **Mai** inline styles - usare sempre classi Tailwind
2. **Mai** colori hardcoded - usare palette slate/accent
3. **Mai** dimensioni pixel - usare scale Tailwind (4, 5, 6, etc.)
4. **Mai** z-index casuali - usare scale: 10, 20, 30, 40, 50
5. **Mai** font-size in px - usare classi text-sm, text-base, etc.
6. **Mai** dimenticare responsive - sempre mobile-first
7. **Mai** animazioni senza `prefers-reduced-motion` check per accessibilità
