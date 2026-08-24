# 📦 PAAA-Tool — Stack Tecnologico

> Documentazione dettagliata dello stack tecnologico, architettura e funzionalità attuali del progetto **PAAA-Tool** (Caccia al Tesoro Evolution).

---

## 🎯 Descrizione del Progetto

**PAAA-Tool** è un'applicazione web per la gestione di una **Caccia al Tesoro** organizzata dal **Pro Loco Venticanese** tramite il **Comitato PAAA (Per Aspera ad Astra)**. L'app è progettata per essere:

- **Container-oriented**: deploy via Docker
- **Offline-first**: supporto per operazioni offline con sincronizzazione background
- **Single-tenant**: architettura semplificata senza logica multi-tenant

---

## 🏗️ Architettura Generale

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                        │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  SvelteKit UI  │  │  SQLite WASM     │  │  Web Worker     │  │
│  │  + TailwindCSS │  │  (OPFS Storage)  │  │  (Sync Queue)   │  │
│  └────────────────┘  └──────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE STACK                         │
│  ┌───────────────────────────┐  ┌────────────────────────────┐  │
│  │     paaa_app (Bun)        │  │     paaa_db (sqld)         │  │
│  │  SvelteKit + Drizzle ORM  │◄─┤  LibSQL Server (SQLite)    │  │
│  │       :3000               │  │      :8080 / :9090         │  │
│  └───────────────────────────┘  └────────────────────────────┘  │
│                    plv_network (external)                       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    [ Reverse Proxy (esterno) ]
                       Nginx / Traefik / NPM
```

---

## 📚 Stack Tecnologico

### 🖥️ Frontend

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **Svelte** | `^5.38.0` | Framework UI reattivo di nuova generazione (Svelte 5 con runes) |
| **SvelteKit** | `^2.22.0` | Meta-framework per SSR, routing file-based e API endpoints |
| **Vite** | `^7.1.0` | Build tool ultra-veloce per development e production |
| **TailwindCSS** | `^4.1.11` | Framework CSS utility-first (v4 con nuova architettura) |
| **PostCSS** | `^8.5.6` | Processor CSS per trasformazioni automatiche |
| **Autoprefixer** | `^10.4.21` | Aggiunge vendor prefixes CSS automaticamente |

### 🎨 UI Components

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **shadcn-svelte** | Configurato via `components.json` | Sistema di componenti UI basato su Radix primitives |
| **lucide-svelte** | `^0.535.0` | Libreria di icone SVG per Svelte |

**Componenti UI attualmente installati:**
- `Button` — Pulsante con varianti (default, secondary, outline)
- `Card` — Card container con Header, Content, Description, Footer, Title

### 📊 Database & ORM

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **Drizzle ORM** | `^0.44.4` | ORM type-safe per TypeScript (server-side) |
| **Drizzle Kit** | `^0.31.4` | CLI per migrations e studio database |
| **@libsql/client** | `^0.15.14` | Client HTTP/WebSocket per LibSQL |
| **LibSQL Server (sqld)** | `latest` | Fork SQLite distribuito (container `ghcr.io/tursodatabase/libsql-server`) |

### 🌐 Client-Side Database (Offline-First)

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **@sqlite.org/sqlite-wasm** | `^3.51.1-build2` | SQLite compilato in WebAssembly per browser |
| **OPFS** | Nativo browser | Origin Private File System per persistenza locale |

### 🔄 State Management & Data Fetching

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **TanStack Query (Svelte)** | `^5.83.0` | Gestione cache, fetch e sincronizzazione dati |

### 🏃 Runtime & Build

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **Bun** | `alpine` (Docker) | Runtime JavaScript ultra-veloce + package manager |
| **svelte-adapter-bun** | `^0.5.2` | Adapter SvelteKit per deploy con Bun runtime |
| **TypeScript** | `^5.9.2` | Superset tipizzato di JavaScript |

### 🐳 Containerizzazione

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **Docker** | — | Containerizzazione applicazione |
| **Docker Compose** | v3 | Orchestrazione multi-container |

**Immagini Docker utilizzate:**
- `oven/bun:alpine` — Runtime Bun per build e produzione
- `ghcr.io/tursodatabase/libsql-server:latest` — Database LibSQL

### 🧹 Code Quality

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **ESLint** | `^9.33.0` | Linter per JavaScript/TypeScript |
| **Prettier** | `^3.6.2` | Code formatter |
| **prettier-plugin-svelte** | `^3.4.0` | Plugin Prettier per file Svelte |
| **eslint-config-prettier** | `^10.1.8` | Integrazione ESLint + Prettier |
| **svelte-check** | `^4.3.1` | Type-checking per file Svelte |

### 📦 Type Definitions

| Tecnologia | Versione | Descrizione |
|------------|----------|-------------|
| **@types/node** | `^24.0.0` | Definizioni TypeScript per Node.js |

---

## 🗄️ Schema Database

### Tabelle Server-Side (Drizzle)

```typescript
// src/lib/server/schema.ts

// EVENTS — Eventi CaTE
events {
  id: TEXT PRIMARY KEY (UUIDv7)
  name: TEXT NOT NULL
  slug: TEXT UNIQUE NOT NULL
  isActive: BOOLEAN DEFAULT false
  themeConfig: JSON (nullable)
  createdAt: INTEGER (epoch ms)
  updatedAt: INTEGER (epoch ms)
}

// FACTIONS — Fazioni/Contrade per Evento
factions {
  id: TEXT PRIMARY KEY (UUIDv7)
  eventId: TEXT FK -> events.id (cascade)
  name: TEXT NOT NULL
  color: TEXT
  icon: TEXT (emoji)
  avatarUrl: TEXT (nullable)
  factionType: TEXT (nullable) -- Es: Precettoria, Rione
  createdAt: INTEGER (epoch ms)
  updatedAt: INTEGER (epoch ms)
}

// FACTION_MANAGERS — Relazione N:N Manager Fazioni
faction_managers {
  factionId: TEXT FK -> factions.id (cascade)
  userId: TEXT FK -> users.id (cascade)
  assignedAt: INTEGER
  PRIMARY KEY (factionId, userId)
}

// USERS — Identità (Admin, Staff, Giocatori)
users {
  id: TEXT PRIMARY KEY (UUIDv7)
  email: TEXT UNIQUE (nullable)
  passwordHash: TEXT (nullable)
  name: TEXT (nullable)
  avatarUrl: TEXT (nullable)
  role: 'admin' | 'staff' | 'player'
  teamId: TEXT FK -> teams.id (nullable)
  createdAt: INTEGER (epoch ms)
  updatedAt: INTEGER (epoch ms)
}

// TEAMS — Entità Squadra
teams {
  id: TEXT PRIMARY KEY (UUIDv7)
  name: TEXT NOT NULL
  joinCode: TEXT UNIQUE NOT NULL
  scoreCache: INTEGER DEFAULT 0
  color: TEXT DEFAULT '#3b82f6'
  avatarUrl: TEXT (nullable)
  description: TEXT (nullable)
  currentPhaseId: TEXT FK -> phases.id
  factionId: TEXT FK -> factions.id (nullable)
  createdAt: INTEGER
  updatedAt: INTEGER
}

// PHASES — Fasi di gioco
phases {
  id: TEXT PRIMARY KEY (UUIDv7)
  name: TEXT NOT NULL
  status: 'active' | 'inactive'
  sortOrder: INTEGER
}

// MESSAGES — Comunicazioni Staff <-> Squadre
messages {
  id: TEXT PRIMARY KEY (UUIDv7)
  senderId: TEXT FK -> users.id
  recipientId: TEXT FK -> users.id
  content: TEXT NOT NULL
  isRead: BOOLEAN DEFAULT false
  sentAt: INTEGER
}

// TEAM_HINTS — Suggerimenti per Squadra
team_hints {
  id: TEXT PRIMARY KEY (UUIDv7)
  teamId: TEXT FK -> teams.id (cascade)
  maxHints: INTEGER DEFAULT 3
  usedHints: INTEGER DEFAULT 0
}

// CONFIG — Chiave Valore dinamici
config {
  key: TEXT PRIMARY KEY
  value: TEXT
}
```

### Schema Client-Side (SQLite WASM)

```sql
-- src/lib/client/db/local-schema.ts

-- Mirror server tables per offline
events, teams, challenges, team_completions

-- Mutation Queue (Outbox Pattern)
mutation_queue {
  id TEXT PRIMARY KEY
  type TEXT              -- es. "team.completed_challenge"
  payload_json TEXT
  created_at INTEGER
  status TEXT            -- 'pending' | 'processing' | 'done' | 'failed'
  attempt_count INTEGER
  last_error TEXT
  next_attempt_at INTEGER
}
```

---

## 🔧 Funzionalità Implementate

### ✅ Attualmente Funzionanti

1.  **Home Page** (`/`)
    -   Hero section con stile "cosmic / Ad Astra" e gradiente viola
    -   Cards informative sull'evento con effetti glassmorphic
    -   CTA verso `/login` (accesso unico Squadra/Staff)
    -   Design responsive e curato con animazioni micro-interattive

2.  **Autenticazione & Login** (`/login`)
    -   Doppia modalità di accesso:
        -   **Squadra**: login tramite `Join Code` univoco
        -   **Staff/Admin**: login tramite Email + Password (hashed con Argon2id)
    -   Redirezione intelligente basata sul ruolo:
        -   Admin/Staff -> `/dashboard`
        -   Player -> `/game`
    -   Protezione CSRF e Sessioni sicure (HttpOnly, Secure, SameSite)

3.  **Dashboard Admin** (`/dashboard`)
    -   **Sidebar navigazione**: Theme toggle (light/dark), user info, logout
    -   **Sommario Statistiche**: Box numerici per Giocatori, Staff, Squadre ed Eventi Attivi
    -   **Gestione Utenti** (`/dashboard/users`):
        -   CRUD completo utenti con avatar upload
        -   Filtri per ruolo e ricerca testuale
        -   Assegnazione team agli utenti
        -   Dialog modale Shadcn-themed per creazione/modifica
        -   Dialog di conferma eliminazione personalizzato
    -   **Gestione Teams** (`/dashboard/teams`):
        -   CRUD completo squadre con avatar e descrizione
        -   Upload file allegati per team
        -   Assegnazione membri ai team
        -   Visualizzazione codice accesso univoco
        -   Card layout con layout responsive
    -   **Modulo CaTE - Eventi e Fazioni** (`/dashboard/events`):
        -   **Gestione Eventi**: CRUD completo eventi (nome, slug URL, stato attivo)
        -   **Card eventi selezionabili**: Click per filtrare le fazioni dell'evento
        -   **Gestione Fazioni**: CRUD completo fazioni con:
            -   Nome e tipo fazione (es: Precettoria, Contrada, Rione)
            -   Color picker con preset colori
            -   Icona emoji personalizzabile
            -   **Avatar manuale**: Upload di immagini per le fazioni via API `/api/faction_avatars`
            -   **Multi-Manager**: Assegnazione di multipli manager (staff) per fazione tramite tabella junction
            -   Assegnazione team alle fazioni
        -   **Dialog modale avanzato**: Form creazione/modifica con preview colore
        -   **Gerarchia completa**: Evento → Fazioni → Teams → Players
    -   **Impostazioni** (`/dashboard/settings`): Placeholder

4.  **Aree Riservate (Skeleton)**
    -   **Game Area** (`/game`): Interfaccia giocatore con stato tappe e messaggi

5.  **Infrastruttura Database**
    -   Singleton Drizzle client (`src/lib/server/db.ts`)
    -   Schema normalizzato: Events -> Factions -> Teams -> Users
    -   Relazioni complete con Drizzle ORM
    -   Auto-sync dello schema all'avvio del container
    -   **Auto-seeding**: Creazione automatica Super Admin da variabili d'ambiente

6.  **Sistema di Build & Docker**
    -   Docker multi-stage build ottimizzata
    -   Entrypoint script per gestione migrazioni e seed
    -   Supporto per variabili d'ambiente runtime
    -   VS Code settings per Tailwind v4 compatibility

7.  **Codex Janara (Enigmi Cifrati)**
    -   **Sistema di Cifratura**: Messaggi protetti da parola chiave personalizzata per fazione.
    -   **Player/Public View**: Interfaccia immersiva a tema "Stregoneria Medievale" con supporto Light (Pergamena) e Dark (Mistico) mode.
    -   **QR Code & Stampa**: Generazione automatica di QR Code vettoriali per la stampa fisica degli indizi.
    -   **Decriptazione**: Accesso diretto tramite scansione QR e sblocco contenuto tramite parola magica.

### 🚧 Da Implementare

-   [ ] Dashboard squadre completa (grafici, progressi)
-   [ ] Logica di gioco (sblocco tappe, invio soluzioni)
-   [ ] Sistema di messaggistica realtime
-   [ ] Sistema di scoring avanzato
-   [ ] Endpoint API `/api/sync` per app mobile/offline

---

## 📁 Struttura Directory

```
PAAA-Tool/
├── src/
│   ├── app.css                 # Entry CSS con Tailwind
│   ├── app.html                # Template HTML
│   ├── app.d.ts                # Type declarations
│   ├── hooks.server.ts         # Server hooks (minimal)
│   ├── lib/
│   │   ├── client/
│   │   │   ├── db/
│   │   │   │   ├── sqlite.ts           # Init SQLite WASM + OPFS
│   │   │   │   └── local-schema.ts     # Schema SQL per client
│   │   │   ├── sync/
│   │   │   │   ├── mutation-queue.ts   # Gestione coda mutazioni
│   │   │   │   └── sync-worker-client.ts
│   │   │   └── query/
│   │   │       └── use-offline-mutation.ts
│   │   ├── server/
│   │   │   ├── db.ts                   # Singleton Drizzle + LibSQL
│   │   │   └── schema.ts               # Schema Drizzle (tabelle)
│   │   ├── components/
│   │   │   └── ui/
│   │   │       ├── button/
│   │   │       └── card/
│   │   ├── utils/
│   │   │   ├── cn.ts                   # Class name utility
│   │   │   └── uuidv7.ts               # Generatore UUIDv7
│   │   └── workers/
│   │       └── sync.worker.ts          # Web Worker sync
│   └── routes/
│       ├── +layout.svelte              # Root layout
│       └── +page.svelte                # Home page
├── static/                              # Asset statici
├── sqld-data/                          # Persistenza DB (gitignored)
├── Dockerfile                          # Multi-stage build
├── docker-compose.yml                  # Orchestrazione
├── package.json                        # Dipendenze
├── bun.lock                            # Lockfile Bun
├── svelte.config.js                    # Config SvelteKit
├── vite.config.ts                      # Config Vite
├── tailwind.config.ts                  # Config Tailwind
├── postcss.config.cjs                  # Config PostCSS
├── tsconfig.json                       # Config TypeScript
├── components.json                     # Config shadcn-svelte
├── env.example                         # Template variabili ambiente
└── README.md                           # Documentazione base
```

---

## 🌍 Variabili d'Ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address app |
| `PORT` | `3000` | Porta app |
| `PUBLIC_APP_URL` | — | URL pubblico (dietro proxy) |
| `ORIGIN` | — | Origin canonico per SvelteKit |
| `DATABASE_URL` | `http://db:8080` | URL server LibSQL |
| `DATABASE_AUTH_TOKEN` | — | Token auth DB (opzionale) |
| `LIBSQL_ADMIN_AUTH_KEY` | — | Chiave admin API sqld |
| `DATABASE_ADMIN_URL` | `http://db:9090` | URL admin API |

---

## 🚀 Script NPM/Bun

| Comando | Descrizione |
|---------|-------------|
| `bun run dev` | Avvia development server con HMR |
| `bun run build` | Build produzione |
| `bun run preview` | Preview build produzione |
| `bun run check` | Type-check Svelte + TypeScript |
| `bun run lint` | Esegue ESLint |
| `bun run format` | Formatta codice con Prettier |
| `bun run sync` | Sincronizza tipi SvelteKit |

---

## 🐳 Comandi Docker

```bash
# Crea network esterno (una volta)
docker network create plv_network

# Build e avvia
docker compose up -d --build

# Solo avvia (senza rebuild)
docker compose up -d

# Ferma
docker compose down

# Log
docker compose logs -f app
docker compose logs -f db
```

---

## 📝 Note Tecniche

### UUIDv7
Il progetto usa **UUIDv7** (RFC 9562) per tutti gli ID delle tabelle:
- Time-ordered per performance indicizzazione
- Contatore monotono per collisioni same-ms
- Implementazione custom in `src/lib/utils/uuidv7.ts`

### Offline-First Pattern
1. Ogni mutazione viene prima applicata localmente (SQLite WASM)
2. Se offline: accodata in `mutation_queue`
3. Web Worker drena la coda quando torna online
4. Backend deve essere idempotente (supportare replay)

### TailwindCSS v4
Il progetto usa Tailwind v4 con la nuova architettura:
- Import via `@import "tailwindcss"` in CSS
- Plugin PostCSS dedicato `@tailwindcss/postcss`
- Configurazione TypeScript (`tailwind.config.ts`)

---

## 📅 Ultimo Aggiornamento

**Data**: 20 Gennaio 2026  
**Versione Progetto**: `0.1.0`

---

> *Per Aspera ad Astra* 🚀
