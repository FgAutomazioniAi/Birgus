# Birgus: installazione
## 1. Requisiti del server

- Windows 11 con Docker Desktop e backend WSL2, oppure Linux con Docker Engine e Compose v2.
- Git e almeno 16 GB di RAM per Birgus, OCR e un provider AI esterno. Per vLLM locale servono GPU NVIDIA, driver compatibili e memoria video adeguata al modello.
- Porte libere: `80` per Birgus, `13001` backend, `13100` frontend, `15433` PostgreSQL e `13900-13903` Garage. Le ultime porte possono restare solo LAN.

## 2. Copia del progetto

In PowerShell, nella cartella scelta sul server:

```powershell
git clone <URL_DELLA_REPOSITORY> Birgus
Set-Location .\Birgus
```
## 3. Crea i segreti

Per ogni segreto esegui questa funzione PowerShell e conserva il valore ottenuto in un password manager:

```powershell
function New-BirgusSecret { $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); [Convert]::ToHexString($bytes).ToLowerInvariant() }
New-BirgusSecret
```

Necessario per `AUTH_PEPPER`, `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `GARAGE_METRICS_TOKEN`, `GARAGE_S3_SECRET_ACCESS_KEY` e `OCR_LIFECYCLE_TOKEN`.

## 4. Crea `.env` e Garage

```powershell
Copy-Item .env.example .env
Copy-Item .\garage\garage.toml.example .\garage\garage.local.toml
```

Modifica `.env`, Sostituisci tutti i `CHANGE_ME` e configura il provider AI. In una configurazione con vLLM su un altro PC della LAN:

```dotenv
AI_PROVIDER=vllm
AI_PROVIDER_BASE_URL=http://192.168.1.253:8000/v1
AI_PROVIDER_API_KEY=
AI_PROVIDER_CHAT_MODEL=nome-modello
```

Nel file `garage/garage.local.toml` inserisci gli stessi tre valori Garage presenti in `.env`:

```toml
rpc_secret = "VALORE_DI_GARAGE_RPC_SECRET"
admin_token = "VALORE_DI_GARAGE_ADMIN_TOKEN"
metrics_token = "VALORE_DI_GARAGE_METRICS_TOKEN"
```

Per accesso HTTPS con dominio, imposta anche `AUTH_COOKIE_SECURE=true`, `TRUST_PROXY=true`, `AUTH_COOKIE_DOMAIN=tuo.dominio` e usa una configurazione Caddy/HTTPS adatta al dominio.

## 5. Scegli i nodi standard dei workflow

I nodi sono nel codice e vengono sempre distribuiti con Birgus. L'attivazione iniziale dei nodi strumento viene decisa dallo sviluppatore in `.env` tramite `WORKFLOW_STANDARD_TOOL_KEYS`.

Chiavi disponibili:

- `langchain_compose_email`
- `langchain_format_text`
- `workflow_format_template`
- `workflow_verify_and_route`
- `workflow_request_decision`

Esempio minimale, senza strumenti AI:

```dotenv
WORKFLOW_STANDARD_TOOL_KEYS=workflow_format_template,workflow_verify_and_route,workflow_request_decision
```

Lasciando la variabile vuota vengono attivati tutti gli strumenti standard. Dopo una modifica riavvia l'applicazione con `docker compose up -d --build app`; l'entrypoint sincronizza il catalogo e abilita/disabilita i nodi per tutti i workspace esistenti.

## 6. Avvia l'infrastruttura

```powershell
docker compose up -d --build
```

Attendi che `birgus_app`, `birgus_frontend`, `birgus_pg` e `birgus_garage` siano `healthy` dove previsto. I primi avvii OCR possono richiedere il download dei modelli solo al primo utilizzo.

Verifica il backend:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:13001/health | Select-Object -ExpandProperty StatusCode
```

CHECKPOINT: A questo punto esistono ruoli, permessi, moduli, dipendenze e tipi file, ma non utenti e non workspace.

## 7. Crea organizzazione, primo workspace e primo superuser

Scegli prima i moduli da rendere disponibili nel primo workspace. Le dipendenze sono validate: `workflow_management` richiede `agent_management` e `document_intelligence`; quest'ultimo richiede `document_archive`.

Esempio completo da eseguire nel terminale del server:

```powershell
docker compose exec app npm run instance:initialize -- --organization-code fg-automazioni --organization-name "FG Automazioni" --workspace-code principale --workspace-name "Workspace principale" --email amministratore@azienda.it --first-name Samuel --last-name Mazzocato --password "Temporanea1" --modules __X moduli che vuoi (inserisci tutti)__
```

```moduli
project_management
agent_management
ddt_processing
measure_report
document_archive
document_intelligence
conversational_assistant
ai_runtime_control
workflow_management
customer_map
offer_priority
maintenance_proposals
maintenance_calendar
notification_center
audit_center
superadmin_center
```

Il comando è consentito solo se non esiste alcun workspace attivo e alcun superuser. Crea in un'unica transazione:

1. organizzazione;
2. workspace attivo;
3. utente superuser con membership al workspace;
4. moduli selezionati;
5. status progetto, revisioni e preferenze iniziali.

La password temporanea deve avere almeno 8 caratteri, una maiuscola e un numero. L'utente è marcato `must_change_password`, quindi il primo login richiede la scelta della password definitiva.

L'inizializzazione crea anche uno snapshot immutabile del profilo di installazione nel database: moduli selezionati, nodi standard del workflow configurati, versione e hash SHA-256. Non include password, chiavi API o altri segreti del file `.env`.

Per un'istanza esistente prima di questo meccanismo, oppure dopo una variazione intenzionale delle funzionalità abilitate, registra la configurazione attuale con:

```powershell
docker compose exec app npm run instance:snapshot
```

Subito dopo inizializza i nodi standard del workflow per il workspace appena creato:

```powershell
docker compose exec app npm run db:sync:workflow-tools
```

## 8. Primo accesso e controlli

Apri `http://IP_DEL_SERVER/` oppure il nome DNS configurato. Accedi con email e password temporanea e imposta subito la password definitiva. Verifica in Superadmin che siano presenti solo i moduli selezionati; da qui puoi gestire utenti, ruoli e abilitazioni per workspace.

Controlli minimi:

```powershell
docker compose ps
docker compose logs --tail 100 app
docker compose exec -T postgres psql -U postgres -d birgus -c "SELECT code, name FROM workspaces WHERE deleted_at IS NULL;"
```

## 9. Aggiornamenti futuri

```powershell
git pull
docker compose up -d --build
docker compose ps
```

L'avvio applica `prisma db push`, il bootstrap del catalogo tecnico e la sincronizzazione dei nodi standard. Se trova una vecchia installazione con Spedizioni, l'entrypoint elimina automaticamente il vecchio dominio prima dell'allineamento Prisma. Non crea utenti o workspace aggiuntivi.

## 10. Backup e ripristino

Prima di aggiornamenti importanti:

```powershell
npm run ops:backup
```

Conserva il backup fuori dal server. Per un ripristino completo servono dump PostgreSQL, dati Garage e la stessa configurazione `.env`; senza `AUTH_PEPPER` le password esistenti non sono verificabili e senza i segreti Garage gli oggetti non sono accessibili.

## 11. Sicurezza operativa

- Non committare `.env`, `garage.local.toml`, `postgres_data` o backup.
- Usa password temporanee uniche e cambia subito quella del primo superuser.
- Limita Docker, SSH e PostgreSQL alla LAN/VPN.
- Configura DNS e HTTPS prima di rendere l'istanza disponibile fuori dalla rete locale.
- Verifica periodicamente `npm run audit:prod`, `npm run typecheck` e i log Docker.
