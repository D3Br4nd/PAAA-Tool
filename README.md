<div align="center">

<a href="https://www.prolocoventicano.com" target="_blank" rel="noopener noreferrer">
  <img src="static/plv-logo.png" alt="Pro Loco Venticanese" width="110" />
</a>

# 🏴‍☠️ PAAA Tool

### *Caccia al Tesoro Evolution*

**La piattaforma open-source self-hosted per la gestione completa di cacce al tesoro ed eventi gamificati a squadre.**

[![Version](https://img.shields.io/badge/Versione-0.2.0-blue?style=for-the-badge)](#-versionamento)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Made with Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.50-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://kit.svelte.dev)
[![Bun Runtime](https://img.shields.io/badge/Bun-Runtime-f9f1e1?style=for-the-badge&logo=bun&logoColor=14151a)](https://bun.sh)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

---

[🚀 Quick Start](#-quick-start) •
[✨ Funzionalità](#-funzionalità) •
[🛠️ Tech Stack](#%EF%B8%8F-tech-stack) •
[🐳 Deploy Docker](#-docker-deployment) •
[🎯 Scoring Engine](#-scoring-types) •
[📖 Documentazione](#-documentazione) •
[📄 Licenza](#-licenza)

</div>

---

## 📋 Panoramica

**PAAA Tool** è una piattaforma web full-stack moderna e reattiva, progettata per organizzare e gestire eventi interattivi e cacce al tesoro sul campo. Nata per supportare la *Caccia al Tesoro Evolution* del **Comitato PAAA (Per Aspera ad Astra)** e della **Pro Loco Venticanese**, la piattaforma offre una suite completa per la gestione di squadre, enigmi, prove di abilità, checkpoint GPS, sorteggi live trasparenti e classifiche in tempo reale.

### 🎯 Casi d'Uso Principali

- 🎪 **Eventi cittadini & Sagre** — Cacce al tesoro urbane e itineranti
- 🏫 **Scuole & Associazioni** — Giochi educativi a tappe, quiz e sfide collaborative
- 🏢 **Team Building Aziendale** — Competizioni gamificate e percorsi a punti
- 🎭 **Giochi di Ruolo & Escape Room Urbane** — Avventure immersive con messaggi cifrati e indizi segreti

---

## ✨ Funzionalità

<table>
<tr>
<td width="50%" valign="top">

### 🎮 Core Gaming & Fazioni
- ⚔️ **Sistema Fazioni & Squadre** — Suddivisione dei partecipanti in casate o fazioni con stemmi e colori dedicati
- 🏆 **Classifiche Real-Time** — Leaderboard live pubblica con aggiornamenti istantanei e animazioni
- 📊 **Scoring Ledger** — Registro transazionale immutabile di tutti i punti assegnati o dedotti
- ⏱️ **Timer Globale Sincronizzato** — Countdown sincronizzato per inizio, fine fase e tempo residuo

</td>
<td width="50%" valign="top">

### 📍 GeoPhase & Checkpoint GPS
- 🗺️ **Tappe Georeferenziate** — Coordinate GPS con raggio di prossimità configurabile
- 📡 **Verifica Posizione sul Posto** — Sblocco della prova solo al raggiungimento fisico del punto
- 🏃 **Bonus Velocità di Arrivo** — Punteggio scalare per ordine di arrivo al checkpoint
- 🎯 **Sfide sul Checkpoint** — Domande e quiz associati alla posizione geografica

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🔮 Codex Janara (Crittografia)
- 🔐 **Enigmi Cifrati** — Messaggi segreti e indizi protetti da parole chiave (cifrario personalizzato)
- 📱 **QR Code Dinamici** — Generazione istantanea di link brevi e QR code per ogni enigma
- 🖨️ **Export PNG Alta Risoluzione** — Download dei QR code ottimizzati per la stampa su cartelli o indizi fisici
- 🧙‍♀️ **Tema Medieval Witch** — Interfaccia a tema fantasy con supporto Light / Dark mode

</td>
<td width="50%" valign="top">

### 📱 Staff PWA (Giudici sul Campo)
- 📱 **Mobile-First Progressive Web App** — Installabile su smartphone, ottimizzata per giudici e arbitri
- ⚡ **Assegnazione Rapida Punti** — Interfacce dedicate per ogni tipo di prova (timer, checklist, tentativi)
- 🎫 **Accesso Staff Semplificato** — Credenziali dedicate con permessi granulari per fase o evento
- 📶 **Offline-Resilient** — Progettata per operare con connettività mobile instabile

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 👥 Gestione Partecipanti
- 🎟️ **Accesso con Join Code** — I giocatori entrano direttamente con il codice univoco del proprio team
- 👤 **Super Admin & Staff Roles** — Autenticazione protetta per amministratori e giudici
- 🎨 **Avatar & Badge Dinamici** — Generatore avatar vettoriale locale (zero chiamate esterne)
- 💬 **Messaggistica & Broadcast** — Invio di annunci, indizi e notifiche a singoli team o broadcast

</td>
<td width="50%" valign="top">

### 🎲 Randomizzatore & Sorteggi Live
- 🎲 **Massima Trasparenza Pubblica** — Estrazioni casuali imparziali e proiettabili in diretta su maxi-schermo con animazioni e suspense
- ⚔️ **Abbinamento Sfide 1v1** — Creazione automatica di coppie di squadre per scontri diretti o griglie di partenza (con gestione squadra dispari)
- 📡 **Sincronizzazione Real-Time** — I partecipanti seguono i sorteggi live e il reveal progressivo direttamente dai propri smartphone
- 🛡️ **Tracciabilità & Equità** — Risultati salvati su DB e consultabili da chiunque, a garanzia di totale imparzialità

</td>
</tr>
<tr>
<td width="100%" colspan="2" valign="top">

### 🔒 Sicurezza & Affidabilità
- 🛡️ **Hardened by Design** — Cookie `Secure`, flag `HttpOnly`, protezione CSRF con `trustedOrigins`
- 📁 **Protezione File & Media** — Validazione upload tramite *magic bytes* e prevenzione path traversal
- 🐳 **Zero Hardcoded Secrets** — Segreti letti dinamicamente a runtime, DB isolato e protetto
- 🔄 **Manutenzione Database** — Auto-push schema Drizzle e seeding automatico con recovery mode

</td>
</tr>
</table>

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Tecnologia | Descrizione |
|:---:|:---:|:---|
| 🎨 | **Svelte 5** | Framework UI reattivo di ultima generazione con Runes (`$state`, `$derived`, `$effect`) |
| ⚡ | **SvelteKit 2** | Full-stack meta-framework con Server-Side Rendering (SSR) e API endpoints |
| 🎯 | **TypeScript** | Type-safety rigorosa end-to-end su tutto il frontend e backend |
| 💨 | **TailwindCSS v4** | Framework CSS utility-first moderno |
| 🧩 | **shadcn-svelte** | Componenti UI accessibili e personalizzabili |
| 🎭 | **Lucide Icons** | Set di icone vettoriali moderno |
| 🗄️ | **libSQL / Turso (`sqld`)** | Database SQLite embedded/server distribuito e performante |
| 🔧 | **Drizzle ORM** | ORM TypeScript type-safe con generatore e migrazioni automatiche |
| 🚀 | **Bun** | Runtime JavaScript & package manager ultra-veloce |
| 🐳 | **Docker & Compose** | Containerizzazione production-ready multi-stage |

</div>

### 📊 Architettura di Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    🌐 Reverse Proxy (HTTPS)                 │
│              (Nginx Proxy Manager / Traefik / Caddy)        │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (:443) -> HTTP (:3000)
┌─────────────────────────▼───────────────────────────────────┐
│                   🐳 Docker Network                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              📦 paaa-tool-app                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │  SvelteKit  │  │   Drizzle   │  │  Bun Server │  │    │
│  │  │    (SSR)    │  │    (ORM)    │  │   (:3000)   │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │ HTTP (:8080)                    │
│  ┌────────────────────────▼────────────────────────────┐    │
│  │              📦 paaa-tool-db                        │    │
│  │         libSQL Server (sqld)                        │    │
│  │              :8080 (Data) / :9090 (Admin)           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Requisiti di Sistema

- [Bun](https://bun.sh) (raccomandato) oppure [Node.js](https://nodejs.org) v18+
- [Docker](https://docker.com) & Docker Compose (per il deploy in produzione)

### 💻 Installazione in Locale

```bash
# 1️⃣ Clona il repository
git clone https://github.com/D3Br4nd/PAAA-Tool.git
cd PAAA-Tool

# 2️⃣ Installa le dipendenze
bun install
# oppure: npm install

# 3️⃣ Configura l'ambiente
cp .env.example .env

# 4️⃣ Genera un AUTH_SECRET sicuro (minimo 32 caratteri)
# Su Linux/macOS puoi usare: openssl rand -base64 48
# ed inserirlo nel file .env

# 5️⃣ Avvia il server di sviluppo
bun dev
# oppure: npm run dev
```

L'applicazione sarà accessibile su `http://localhost:5173`.

---

## 🐳 Docker Deployment

Il progetto è **pronto per la produzione** con un `Dockerfile` multi-stage ottimizzato e `docker-compose.yml`.

### 🚢 Avvio con Docker Compose

```bash
# 1️⃣ Crea la rete Docker condivisa (se non esiste già)
docker network create plv_network

# 2️⃣ Prepara il file di configurazione
cp .env.example .env
# Modifica .env inserendo AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD e gli URL del tuo dominio

# 3️⃣ Avvia lo stack
docker compose up -d --build
```

### ⚙️ Variabili d'Ambiente

Tutte le opzioni di configurazione sono gestite tramite variabili d'ambiente:

| Variabile | Descrizione | Default / Esempio | Obbligatoria |
|:---|:---|:---:|:---:|
| `AUTH_SECRET` | Chiave crittografica per la firma dei cookie e token di sessione (min 32 caratteri) | `openssl rand -base64 48` | **Sì** |
| `DATABASE_URL` | URL di connessione al database libSQL/sqld | `http://db:8080` | **Sì** |
| `DATABASE_AUTH_TOKEN` | Token di autenticazione libSQL (se abilitato su sqld) | — | No |
| `ORIGIN` | URL canonico dell'applicazione con protocollo HTTPS | `https://paaa.tuodominio.it` | **Sì (in prod)** |
| `PUBLIC_APP_URL` | URL pubblico per link assoluti e condivisioni QR | `https://paaa.tuodominio.it` | **Sì (in prod)** |
| `ADMIN_EMAIL` | Email del Super Admin creato al primo avvio | `admin@example.com` | No |
| `ADMIN_PASSWORD` | Password iniziale del Super Admin | `UnaPasswordSicura!` | No |
| `APP_VERSION` | Versione applicativa mostrata nella UI | `0.2.0` | No |
| `DRIZZLE_FORCE_PUSH` | Consenti modifiche distruttive allo schema all'avvio | `false` | No |
| `BODY_SIZE_LIMIT` | Limite massimo upload body per allegati e immagini | `21M` | No |
| `HOST` | Indirizzo bind del server interno | `0.0.0.0` | No |
| `PORT` | Porta interna su cui ascolta l'app | `3000` | No |

> ⚠️ **Nota su `AUTH_SECRET`**: Per ragioni di sicurezza, l'applicazione non parte se `AUTH_SECRET` è vuoto o non impostato.

### 🔄 Auto-Setup all'Avvio del Container

All'avvio del container (`entrypoint.sh`), vengono eseguiti automaticamente:
1. **Verifica Database**: attesa della disponibilità di `sqld` su rete interna
2. **Schema Push**: applicazione automatica dello schema Drizzle sul database
3. **Admin Seed**: creazione dell'utente Super Admin iniziale specificato in `ADMIN_EMAIL` / `ADMIN_PASSWORD`

### 💾 Persistenza Dati

```yaml
volumes:
  - ./sqld-data:/var/lib/sqld      # File di database libSQL
  - ./paaa_data:/app/paaa_data     # Upload allegati, loghi e avatar
```

---

## 🎯 Scoring Types

PAAA Tool include un motore di calcolo flessibile con **4 modalità di punteggio** preconfigurate:

```
                  ┌───────────────────────────────┐
                  │    PAAA Scoring Engine        │
                  └──────────────┬────────────────┘
                                 │
     ┌──────────────────┬────────┴─────────┬──────────────────┐
     ▼                  ▼                  ▼                  ▼
🧭 Viaggio        🏛️ Costruttore       ⚔️ Sfida          🔱 Percorso Ostacoli
(Punti fissi)     (Checklist/Item)     (Tentativi)        (Tempo + Penalità + Bonus)
```

1. 🧭 **Viaggio (Punti Fissi)**
   - Punteggio fisso al completamento della tappa o del checkpoint.
   - *Ideale per*: Checkpoint standard, prove di presenza, tappe di passaggio.

2. 🏛️ **Costruttore (Checklist)**
   - Punti progressivi in base al numero di elementi raccolti o completati.
   - *Ideale per*: Cacce al tesoro con elenco oggetti, prove a step multipli.

3. ⚔️ **Sfida (A Tentativi)**
   - Punteggio scalare decrescente in base al numero di errori o tentativi effettuati.
   - *Ideale per*: Enigmi a risposta secca, indovinelli, prove di precisione.

4. 🔱 **Percorso Ostacoli / Giostra**
   - Cronometro in tempo reale, conteggio penalità (+/- ostacoli abbattuti) e bonus speciali.
   - *Ideale per*: Gare a tempo, circuiti ad ostacoli, giostre medievali, prove di velocità.

---

## 📖 Documentazione & Rotte

### 🎛️ Pagine Principali

| Percorso | Ruolo | Livello di Accesso |
|:---|:---|:---:|
| `/` | Landing page evento e presentazione | 🌍 Pubblico |
| `/login` | Accesso partecipanti (Join Code) e Staff (Email/Password) | 🌍 Pubblico |
| `/leaderboard` | Classifica generale live dell'evento | 🌍 Pubblico |
| `/[slug]` | Leaderboard e dettagli di una singola macro-fase/evento | 🌍 Pubblico |
| `/[slug]/sorteggio` | Sorteggio pubblico live & randomizzatore abbinamenti/sfide | 🌍 Pubblico (Live) / 🔐 Admin (Avvio) |
| `/staff` | PWA per i giudici e arbitri sul campo | 🔐 Staff |
| `/dashboard` | Pannello di controllo completo Super Admin | 🔐 Admin |

### 📜 Script npm / bun

```bash
# Sviluppo
bun dev              # Avvia il dev server con hot reload
bun run build        # Compila l'applicazione per produzione
bun run preview      # Anteprima locale della build

# Controllo qualità codice
bun run check        # Type check con svelte-check e TypeScript
bun run lint         # Controllo linter con ESLint
bun run format       # Formattazione codice con Prettier

# Gestione Database
bun run db:push      # Sincronizza lo schema Drizzle con il database
bun run db:generate  # Genera file di migrazione SQL
bun run db:studio    # Avvia l'interfaccia visuale Drizzle Studio
```

---

## 📁 Struttura del Progetto

```
PAAA-Tool/
├── 📁 src/
│   ├── 📁 lib/               # Componenti e utility condivise
│   │   ├── 📁 components/    # Componenti UI (shadcn-svelte)
│   │   ├── 📁 server/        # Codice backend (database, autenticazione, scoring)
│   │   └── 📁 types/         # Definizioni dei tipi TypeScript
│   └── 📁 routes/            # Pagine e API endpoints SvelteKit
├── 📁 drizzle/               # Schemi Drizzle ORM e migrazioni
├── 📁 static/                # Asset statici (immagini, manifest PWA, icone)
├── 📄 Dockerfile             # Multi-stage Docker build per Bun
├── 📄 docker-compose.yml     # Definizione dei servizi App + DB libSQL
├── 📄 entrypoint.sh          # Script di avvio container con migrazioni e seed
├── 📄 LICENSE                # Licenza Open Source MIT
└── 📄 README.md              # Documentazione del progetto
```

---

## 🔢 Versionamento

Il progetto segue il [Semantic Versioning](https://semver.org/lang/it/) (`MAJOR.MINOR.PATCH`).

**Versione corrente: `0.2.0`**

Consulta il file [`package.json`](package.json) e il changelog interno per il dettaglio delle modifiche introdotte in ogni versione.

---

## 🤝 Contribuire

Contributi, segnalazioni di bug e suggerimenti sono benvenuti!

1. Fai il **Fork** del repository
2. Crea un branch per la tua feature (`git checkout -b feature/NuovaFunzionalita`)
3. Esegui i controlli di qualità (`bun run check && bun run lint`)
4. Fai il commit delle modifiche (`git commit -m 'Aggiunta nuova funzionalità'`)
5. Pusha sul tuo branch (`git push origin feature/NuovaFunzionalita`)
6. Apri una **Pull Request**

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza **MIT**. Consulta il file [`LICENSE`](LICENSE) per il testo completo.

---

<div align="center">

<a href="https://www.prolocoventicano.com" target="_blank" rel="noopener noreferrer">
  <img src="static/plv-logo.png" alt="Pro Loco Venticanese" width="80" />
</a>

<br/>

**Sviluppato con ❤️ per la [Pro Loco Venticanese](https://www.prolocoventicano.com)**  
*Comitato PAAA — Per Aspera ad Astra* ✨  
Creato con passione per eventi e cacce al tesoro indimenticabili.

<sub>Se questo progetto ti è utile, lascia una ⭐ su GitHub!</sub>

</div>
