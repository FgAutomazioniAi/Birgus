# Birgus

Birgus viene distribuito tramite Docker Compose. La prima installazione e' gestita da un programma interattivo che prepara l'ambiente, genera i segreti e crea il primo account.

## Requisiti

- Windows 11 con Docker Desktop e WSL2, oppure Linux con Docker Engine;
- Docker Compose v2 (`docker compose`);
- Node.js 22 e npm;
- Git;
- almeno 16 GB di RAM;
- spazio sufficiente per PostgreSQL, Garage e i modelli OCR;
- porte `80`, `13001`, `13100`, `15433` e `13900-13903` disponibili o protette dalla rete locale.

## Prima installazione

Scaricare il progetto e installare le dipendenze necessarie al programma di setup:

```bash
git clone <URL_REPOSITORY> Birgus
cd Birgus
npm ci
```

Avviare l'installazione guidata:

```bash
npm run setup
```

Il terminale richiede:

- nome e codice dell'organizzazione;
- nome e codice del primo workspace;
- nome, cognome, email e password temporanea del Developer;
- porta HTTP pubblica;
- indirizzo, modello ed eventuale API key del provider AI;
- capacita' da assegnare allo storage Garage.

I codici proposti vengono ricavati automaticamente dai nomi e possono essere modificati prima della conferma. Password e API key non sono mostrate a schermo.

Il programma esegue in ordine:

1. verifica di Docker Engine e Docker Compose;
2. generazione di `.env` e `garage/garage.local.toml`;
3. validazione della configurazione;
4. build delle immagini Docker con output visibile;
5. avvio di PostgreSQL e Garage;
6. creazione del layout, della chiave e del bucket Garage;
7. avvio dei servizi e controllo del loro stato;
8. creazione transazionale del workspace e del primo Developer.

Al termine viene mostrato l'indirizzo da aprire nel browser. Al primo accesso il Developer deve cambiare la password temporanea e configurare obbligatoriamente la 2FA.

### Riprendere un'installazione interrotta

Il setup puo' essere eseguito nuovamente con:

```bash
npm run setup
```

Se trova configurazioni locali esistenti, non procede automaticamente. Chiede una conferma esplicita, conserva i segreti gia' generati e crea una copia in `backups/setup-<data>/` prima di modificare i file.

Il setup iniziale non puo' creare un secondo Developer o un altro workspace su un database gia' inizializzato. Gli ambienti esistenti si amministrano dall'applicazione.

## Controllo dei servizi

```bash
docker compose ps
docker compose logs --tail=100 app frontend garage postgres
```

- Frontend: `http://localhost:13100`
- Backend: `http://localhost:13001`
- Health check: `http://localhost:13001/health`

L'indirizzo principale usa la porta scelta durante il setup, normalmente `http://localhost/`.

## Ruoli iniziali

| Ruolo | Ambito | 2FA |
| --- | --- | --- |
| Developer | Intera installazione | Obbligatoria |
| Superuser | Gestione completa del proprio workspace | Facoltativa |
| Admin | Operazioni amministrative del workspace | Facoltativa |
| Operatore | Operazioni applicative assegnate | Facoltativa |

## Provider AI

Birgus usa un endpoint compatibile con le API OpenAI. Il setup accetta anche un provider non ancora raggiungibile: l'applicazione si avvia comunque, mentre le funzioni AI restano indisponibili finche' il servizio non viene collegato.

Per modificare successivamente il provider, aggiornare le variabili `AI_PROVIDER_*` in `.env` e ricreare i container interessati:

```bash
docker compose up -d --force-recreate app python_modules
```

## vLLM sullo stesso server

Compilare `vllm/runtime.env`, impostare `VLLM_LIFECYCLE_TOKEN` in `.env` e avviare il profilo dedicato:

```bash
docker compose --profile ai-runtime up -d --build
```

Il profilo richiede Docker con accesso alla GPU NVIDIA.

## HTTPS

Copiare la configurazione locale:

```bash
cp Caddyfile.https.example Caddyfile.https.local
```

Impostare in `.env` il dominio pubblico, le porte e i cookie sicuri:

```dotenv
BIRGUS_PUBLIC_HOST=birgus.example.com
BIRGUS_HOST_HTTP_PORT=80
BIRGUS_HOST_HTTPS_PORT=443
AUTH_COOKIE_SECURE=true
TRUST_PROXY=true
```

Avviare con l'override HTTPS:

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

DNS e firewall devono consentire a Caddy di raggiungere le porte 80 e 443.

## Sviluppo locale

Per montare i sorgenti e abilitare il reload automatico:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Aggiornamento

Prima di aggiornare creare un backup, quindi ricostruire lo stack:

```powershell
npm run ops:backup
git pull
docker compose up -d --build
```

Il bootstrap applicativo aggiorna schema, catalogo dei ruoli, permessi, moduli e strumenti workflow senza creare automaticamente nuovi utenti o workspace.
