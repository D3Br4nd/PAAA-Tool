# Guida per Contribuire a PAAA Tool

Grazie per l'interesse nel contribuire a **PAAA Tool**! 🎉

Questo documento contiene le linee guida per lo sviluppo, la segnalazione di problemi e l'invio di modifiche.

---

## 🛠️ Setup di Sviluppo

1. **Fai il Fork** del repository su GitHub.
2. **Clona** il tuo fork localmente:
   ```bash
   git clone https://github.com/TUO_USERNAME/PAAA-Tool.git
   cd PAAA-Tool
   ```
3. **Installa le dipendenze**:
   ```bash
   bun install
   # oppure: npm install
   ```
4. **Copia il file delle variabili d'ambiente**:
   ```bash
   cp .env.example .env
   ```
5. **Configura la chiave segreta**:
   Genera una stringa casuale di almeno 32 caratteri per `AUTH_SECRET`:
   ```bash
   openssl rand -base64 48
   ```
6. **Avvia il server di sviluppo**:
   ```bash
   bun dev
   # oppure: npm run dev
   ```

---

## 📐 Standard di Codice e Qualità

Prima di inviare una Pull Request, assicurati che il codice rispetti i controlli di qualità:

- **Controllo Tipi TypeScript / Svelte**:
  ```bash
  bun run check
  ```
- **Linter (ESLint)**:
  ```bash
  bun run lint
  ```
- **Formattazione (Prettier)**:
  ```bash
  bun run format
  ```

---

## 🌿 Flusso di Lavoro Git

1. Crea un branch descrittivo a partire da `main`:
   ```bash
   git checkout -b feature/nome-funzionalita
   # oppure
   git checkout -b fix/descrizione-bug
   ```
2. Effettua commit atomici e con messaggi chiari (convenzione [Conventional Commits](https://www.conventionalcommits.org/)):
   - `feat: aggiunta supporto a nuovo tipo di sfida`
   - `fix: corretta validazione del raggio GPS in GeoPhase`
   - `docs: aggiornato README con nuova variabile d'ambiente`
3. Esegui il push sul tuo branch:
   ```bash
   git push origin feature/nome-funzionalita
   ```
4. Apri una **Pull Request** verso il branch `main` del repository principale descrivendo le modifiche introdotte e i test effettuati.

---

## 🐛 Segnalazione Bug e Richiesta Funzionalità

- Prima di aprire una nuova issue, verifica che non sia già stata segnalata.
- Fornisci quante più informazioni possibili: passaggi per riprodurre il problema, browser/OS utilizzato, log ed eventuali screenshot.

---

## 📄 Licenza

Contribuendo a questo progetto, accetti che i tuoi contributi siano rilasciati sotto i termini della [Licenza MIT](LICENSE).
