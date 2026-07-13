# LEAF — Guida per iniziare a sviluppare (Max & Kemp)

Benvenuto nel team LEAF. Questa guida ti porta da zero a "sto sviluppando" in
circa 30 minuti. Segui i passi **in ordine**. Se qualcosa non torna, fermati e
chiedi — non tirare a indovinare, soprattutto sul database.

> ⚠️ **Regola d'oro numero 1**: non lavori mai sul database di produzione (quello
> con i dati veri di Sport Team). Ti crei un tuo database di sviluppo. Lo vediamo
> al Passo 4. Se sbagli lì, non fai danni a nessuno.

---

## Passo 1 — Installa gli strumenti (una volta sola)

Ti servono 4 cose. Su Mac apri **Terminale** (⌘+Spazio → "Terminale").

1. **Node.js 20 LTS** — il motore del progetto.
   Scarica da https://nodejs.org (versione **LTS**). Poi verifica:
   ```
   node -v      # deve stampare v20.x (o superiore)
   ```
2. **Git** — di solito già presente. Verifica: `git --version`. Se manca, su Mac
   parte da solo la prima volta; oppure `xcode-select --install`.
3. **Claude Code** — l'assistente con cui svilupperai. Installa col **tuo
   account** Claude (serve un tuo abbonamento, non quello di Pietro):
   ```
   npm install -g @anthropic-ai/claude-code
   ```
   Poi lancia `claude` una volta e fai il login.
4. **Un editor** (consigliato ma non obbligatorio): VS Code — https://code.visualstudio.com

---

## Passo 2 — Accetta l'invito al repo

Pietro ti invita come collaboratore su GitHub. Controlla la mail (o
https://github.com/notifications) e **accetta l'invito** al repo
`pitmeggio/LEAF-saas`.

Se non hai un account GitHub, crealo gratis su https://github.com e manda a
Pietro il tuo username.

---

## Passo 3 — Scarica il progetto (clona)

Nel Terminale, vai dove vuoi tenere il progetto e clona:
```
cd ~/Documenti
git clone https://github.com/pitmeggio/LEAF-saas.git
cd LEAF-saas
```
La prima volta GitHub ti chiede di autenticarti: usa **"Sign in with browser"**
se compare, altrimenti crea un *Personal Access Token* (GitHub → Settings →
Developer settings → Tokens) e usalo come password.

---

## Passo 4 — Crea il TUO database di sviluppo (gratis)

Non tocchiamo il DB vero. Ne crei uno tuo su Supabase:

1. Vai su https://supabase.com → **Start your project** (login con GitHub).
2. **New project** → dai un nome (es. `leaf-dev-max`), scegli una password DB
   (**segnala**), regione **EU (Frankfurt)**. Aspetta ~2 minuti che si crei.
3. In alto clicca **Connect** → scheda **Transaction pooler** → copia l'URI. È
   una stringa tipo `postgresql://postgres.xxxx:[YOUR-PASSWORD]@...:6543/postgres`.
4. Copia anche la versione **Session pooler** (porta **5432**) — serve per le
   migrazioni.

---

## Passo 5 — Configura il progetto (.env)

Nella cartella del progetto, crea il file di configurazione partendo dal modello:
```
cp .env.example .env
```
Apri `.env` (con VS Code o `open -e .env`) e incolla i tuoi valori:
- `DATABASE_URL="..."` → l'URI **Transaction pooler** (6543), sostituendo
  `[YOUR-PASSWORD]` con la password del tuo DB.
- `DIRECT_URL="..."` → l'URI **Session pooler** (5432), stessa password.
- `AUTH_SECRET="..."` → una stringa lunga a caso. Generane una con:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

> Il file `.env` **non finisce mai su GitHub** (è escluso apposta). Non
> condividerlo e non incollarlo in chat.

---

## Passo 6 — Installa e avvia

```
npm install                 # scarica le dipendenze (qualche minuto la prima volta)
npx prisma db push          # crea tutte le tabelle sul TUO database
npm run db:seed             # (facoltativo) riempie dati demo per provare
npm run dev                 # avvia il sito
```
Apri **http://localhost:3000** nel browser. Ci sei. 🎾

Per entrare come admin di prova: se hai fatto il seed, le credenziali demo sono
nel file `prisma/seed.ts` (cerca gli utenti creati). Altrimenti chiedi a Pietro.

---

## Passo 7 — Come si lavora ogni giorno (il flusso)

**Non si scrive mai direttamente su `main`.** Ogni cosa nuova va su un *ramo*
(branch) e poi si unisce con una *Pull Request* (PR). Con Claude Code:

1. **Aggiorna e crea il tuo ramo:**
   ```
   git checkout main
   git pull
   git checkout -b tennis/nome-della-feature
   ```
2. **Apri Claude Code nella cartella del progetto:**
   ```
   claude
   ```
   Spiegagli cosa vuoi fare ("aggiungi X alla scheda atleta tennis…"). Claude
   legge il file `CLAUDE.md` e capisce già com'è fatto il progetto — **non devi
   rispiegarglielo ogni volta**.
3. **Verifica** che tutto compili prima di salvare:
   ```
   npx tsc --noEmit
   npm run build
   ```
4. **Salva e carica il tuo ramo:**
   ```
   git add -A
   git commit -m "tennis: descrizione di cosa hai fatto"
   git push -u origin tennis/nome-della-feature
   ```
5. **Apri la PR** su GitHub (compare un bottone "Compare & pull request").
   Pietro (o tu) la controlla e fa **Merge** su `main`.

Così il tuo lavoro e quello degli altri **non si scontrano mai**, e nessuno
lavora su un fork separato.

---

## Le 5 regole d'oro (riassunto)

1. **Mai** il database di produzione. Solo il tuo DB di sviluppo.
2. **Mai** committare `.env` o password/chiavi.
3. **Mai** scrivere su `main`: sempre un ramo + PR.
4. Prima di una PR: `npx tsc --noEmit` e `npm run build` devono passare.
5. Nel dubbio, chiedi. Meglio una domanda che un dato vero rovinato.

Buon lavoro! Il progetto è pensato per il **mondo tennis**: ogni cosa che
costruisci per Sport Team, falla in modo che funzioni per qualsiasi academy.
