---
name: docker-deploy
description: Come buildare e deployare l'applicazione PAAA-Tool con Docker
---

# Build e Deploy con Docker

Questa skill guida le operazioni Docker per build, deploy e troubleshooting.

## Prerequisiti

La network esterna deve esistere:

```bash
docker network create plv_network
```

## Comandi Principali

### Build e Avvio

```bash
# Build e avvia tutti i servizi
docker compose up -d --build
```

### Solo Avvio (senza rebuild)

```bash
docker compose up -d
```

### Rebuild Forzato

```bash
docker compose build --no-cache
docker compose up -d
```

### Stop

```bash
docker compose down
```

## Logs e Debug

### Visualizzare Logs

```bash
# Tutti i servizi
docker compose logs -f

# Solo app
docker compose logs -f app

# Solo database
docker compose logs -f db

# Ultime N righe
docker compose logs --tail=100 app
```

### Shell nel Container

```bash
# App container
docker compose exec app sh

# Database container
docker compose exec db sh
```

## Database Operations

### Push Schema Manuale

```bash
docker compose exec app bunx drizzle-kit push
```

### Drizzle Studio (GUI)

```bash
docker compose exec app bunx drizzle-kit studio
```

### Backup Database

Il database è persistito in `./sqld-data/`. Per backup:

```bash
cp -r ./sqld-data ./sqld-data-backup-$(date +%Y%m%d)
```

## Troubleshooting

### Container non parte

```bash
# Ispeziona logs
docker compose logs app

# Verifica stato
docker compose ps
```

### Errori Database Connection

1. Verifica che il container db sia running:
   ```bash
   docker compose ps db
   ```

2. Verifica network:
   ```bash
   docker network inspect plv_network
   ```

3. Testa connessione:
   ```bash
   docker compose exec app curl http://db:8080/health
   ```

### Reset Completo

```bash
# Stop e rimuovi container
docker compose down

# Rimuovi dati database (ATTENZIONE!)
rm -rf ./sqld-data

# Rebuild da zero
docker compose up -d --build
```

## Variabili d'Ambiente

Le variabili vanno nel file `.env`:

```bash
# App
HOST=0.0.0.0
PORT=3000
ORIGIN=https://your-domain.com
PUBLIC_APP_URL=https://your-domain.com

# Database
DATABASE_URL=http://db:8080
DATABASE_AUTH_TOKEN=

# Admin Seed
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password
```

## Architettura

```
┌─────────────────────────────────────────┐
│            plv_network                  │
│                                         │
│  ┌─────────────┐     ┌──────────────┐   │
│  │  paaa_app   │────►│   paaa_db    │   │
│  │   :3000     │     │  :8080/:9090 │   │
│  └─────────────┘     └──────────────┘   │
│        ▲                                │
└────────│────────────────────────────────┘
         │
   [ Reverse Proxy ]  (esterno)
```

## Checklist Deploy

- [ ] `.env` configurato correttamente
- [ ] Network `plv_network` creata
- [ ] `docker compose up -d --build` eseguito
- [ ] Logs verificati (`docker compose logs -f app`)
- [ ] Container running (`docker compose ps`)
- [ ] App raggiungibile via reverse proxy
