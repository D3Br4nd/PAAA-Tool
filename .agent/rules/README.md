# 📚 PAAA-Tool — Linee Guida

> Riferimenti e pattern per lo sviluppo del progetto PAAA-Tool.

---

## ⚠️ Filosofia

> **Siamo in fase esplorativa!**
> 
> Questi documenti sono **riferimenti**, non regole rigide.
> Tutto può evolvere man mano che capiamo cosa serve davvero.

### Cosa è già deciso
- ✅ Stack tecnologico (Svelte 5, SvelteKit, Drizzle, LibSQL, Bun)
- ✅ UUIDv7 per ID, epoch ms per timestamp
- ✅ Docker per deploy
- ✅ TypeScript

### Cosa è ancora da definire
- 🔄 Struttura pagine e routing
- 🔄 Schema database completo
- 🔄 Autenticazione
- 🔄 Funzionalità specifiche della caccia al tesoro
- 🔄 Design e UX finale

---

## 📋 Documenti Disponibili

| File | Cosa contiene |
|------|---------------|
| [`project-conventions.md`](./project-conventions.md) | Convenzioni base: ID, naming, timestamp |
| [`svelte-sveltekit.md`](./svelte-sveltekit.md) | Pattern Svelte 5 e SvelteKit |
| [`database-drizzle.md`](./database-drizzle.md) | Riferimenti Drizzle ORM |
| [`offline-first.md`](./offline-first.md) | Sistema offline (opzionale, già predisposto) |
| [`styling-ui.md`](./styling-ui.md) | TailwindCSS e componenti UI |
| [`docker-deploy.md`](./docker-deploy.md) | Docker (già configurato) |
| [`api-design.md`](./api-design.md) | Pattern per API (da implementare) |

---

## 🎯 Come Usare Questi Documenti

1. **Consultare** quando serve un riferimento
2. **Copiare** pattern e adattarli
3. **Ignorare** ciò che non serve ancora
4. **Proporre modifiche** se qualcosa non funziona

### Non sono:
- ❌ Regole da seguire alla lettera
- ❌ Documentazione definitiva
- ❌ Contratti immutabili

---

## 📅 Ultimo Aggiornamento

**Data**: 17 Gennaio 2026  
**Stato**: Fase esplorativa
