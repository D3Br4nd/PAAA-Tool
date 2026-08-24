# 🐳 Docker & Deploy

> Riferimento per containerizzazione, deploy e infrastruttura.

---

## ✅ Infrastruttura Pronta

> Docker e docker-compose sono **già configurati e funzionanti**.
> Questo documento è un riferimento, non una guida da seguire step-by-step.

### Già fatto
- ✅ Dockerfile multi-stage
- ✅ docker-compose con app + db
- ✅ Network esterna `plv_network`
- ✅ Persistenza database in `./sqld-data`

### Da valutare in base alle esigenze
- Health checks
- Monitoring/logging
- Backup automatici
- CI/CD

---

## 🏗️ Architettura Container

```
┌──────────────────────────────────────────────────┐
│               plv_network (external)              │
│                                                   │
│  ┌─────────────┐         ┌─────────────────────┐ │
│  │  paaa_app   │ ──────► │      paaa_db        │ │
│  │   (Bun)     │  :8080  │      (sqld)         │ │
│  │   :3000     │         │   :8080 / :9090     │ │
│  └─────────────┘         └─────────────────────┘ │
│        ▲                                         │
└────────│─────────────────────────────────────────┘
         │
    [ Reverse Proxy ]
    (esterno al compose)
```

---

## 📦 Dockerfile

### Multi-stage build
```dockerfile
# Stage 1: Build
FROM oven/bun:alpine AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Runtime
FROM oven/bun:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/build ./build
EXPOSE 3000
CMD ["bun", "./build/index.js"]
```

### Best practices Dockerfile
- **Usare** `--frozen-lockfile` per reproducibilità
- **Copiare** solo file necessari per runtime
- **Separare** install deps da build per cache Docker
- **Usare** immagini alpine per dimensioni ridotte

---

## 🔧 Docker Compose

### Network esterna
```yaml
networks:
  plv_network:
    external: true
    name: plv_network
```

### Creare network (una volta)
```bash
docker network create plv_network
```

### Variabili Environment
```yaml
environment:
  DATABASE_URL: ${DATABASE_URL:-http://db:8080}
  DATABASE_AUTH_TOKEN: ${DATABASE_AUTH_TOKEN:-}
  HOST: ${HOST:-0.0.0.0}
  PORT: ${PORT:-3000}
  NODE_ENV: production
```

### Dipendenze tra servizi
```yaml
services:
  app:
    depends_on:
      - db
```

---

## 💾 Persistenza Database

### Bind mount (non named volume)
```yaml
db:
  volumes:
    - ./sqld-data:/var/lib/sqld
```

### Vantaggi bind mount
- Facile backup (è una directory locale)
- Visibile nel filesystem host
- Facilmente migrabile

### Gitignore
```
sqld-data/
```

---

## 🚀 Comandi Deploy

### Build e avvio
```bash
docker compose up -d --build
```

### Solo avvio (senza rebuild)
```bash
docker compose up -d
```

### Rebuild forzato
```bash
docker compose build --no-cache
docker compose up -d
```

### Stop
```bash
docker compose down
```

### Stop con rimozione volumi
```bash
docker compose down -v  # ATTENZIONE: elimina dati!
```

### Logs
```bash
docker compose logs -f          # Tutti i servizi
docker compose logs -f app      # Solo app
docker compose logs -f db       # Solo DB
docker compose logs --tail=100  # Ultime 100 righe
```

### Shell nel container
```bash
docker compose exec app sh
docker compose exec db sh
```

---

## 🔌 LibSQL Server (sqld)

### Configurazione
```yaml
db:
  image: ghcr.io/tursodatabase/libsql-server:latest
  entrypoint: ["/bin/sqld"]
  command:
    - --enable-namespaces
    - --http-listen-addr
    - 0.0.0.0:8080
    - --admin-listen-addr
    - 0.0.0.0:9090
    - --db-path
    - /var/lib/sqld/data.sqld
```

### Porte
| Porta | Uso |
|-------|-----|
| 8080 | HTTP API (client connections) |
| 9090 | Admin API (namespace management) |

### Non esporre porte all'host
```yaml
expose:
  - "8080"
  - "9090"
# NON usare "ports:" per sicurezza
```

---

## 🔒 Sicurezza

### Rete interna trusted
- Comunicazioni app↔db su rete Docker privata
- No TLS interno (overhead inutile su rete trusted)
- TLS terminato dal reverse proxy

### Variabili sensibili
```bash
# Mai committare .env con secrets!
# Usare .env solo in locale

# In produzione, usare:
# - Docker secrets
# - Variabili ambiente del compose host
# - Vault / secret manager
```

### Admin API
```yaml
LIBSQL_ADMIN_AUTH_KEY: ${LIBSQL_ADMIN_AUTH_KEY:-}
```
Impostare in produzione per proteggere endpoint admin.

---

## 🔄 Reverse Proxy

### Non incluso nel compose
Il reverse proxy (Nginx Proxy Manager, Traefik, Caddy) deve essere configurato separatamente.

### Configurazione richiesta
1. Inoltrare traffico a `paaa_app:3000`
2. Gestire certificati SSL/TLS
3. Header forwarding:
   ```
   X-Forwarded-For
   X-Forwarded-Proto
   X-Forwarded-Host
   ```

### Esempio Nginx config
```nginx
location / {
  proxy_pass http://paaa_app:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_cache_bypass $http_upgrade;
}
```

---

## 🩺 Health Checks

### Aggiungere health check (opzionale)
```yaml
app:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Endpoint health
```typescript
// src/routes/health/+server.ts
import { json } from '@sveltejs/kit';

export function GET() {
  return json({ status: 'ok', timestamp: Date.now() });
}
```

---

## 📊 Monitoring

### Logs strutturati
In produzione, considerare logging JSON per parsing automatico.

### Metriche consigliate
- Response time
- Error rate
- Container CPU/memory
- Database connections

---

## 🚫 Anti-Pattern Deploy

1. **Mai** esporre porte DB all'host senza necessità
2. **Mai** usare `latest` tag in produzione senza motivo
3. **Mai** secrets in Dockerfile o docker-compose.yml
4. **Mai** build in produzione - usare immagini pre-built
5. **Mai** dimenticare `restart: unless-stopped`
6. **Mai** named volumes per dati che devono essere facilmente backuppati
