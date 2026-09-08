# Birgus

## Requisiti

- Windows 11 con Docker Desktop e WSL2, oppure Linux con Docker Engine;
- Docker Compose v2 (`docker compose`);
- Git;
- almeno 16 GB di RAM;
- porte `80`, `13001`, `13100`, `15433` e `13900-13903` disponibili o protette dalla rete locale.

## 1. Scaricare il progetto

```bash
git clone <URL_REPOSITORY> Birgus
cd Birgus
```

## 2. Preparare la configurazione

Su Linux:

```bash
cp .env.example .env
cp garage/garage.toml.example garage/garage.local.toml
```

Su PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item garage/garage.toml.example garage/garage.local.toml
```

Aprire `.env` e sostituire tutti i valori `CHANGE_ME`. Ogni installazione deve avere segreti propri, lunghi e casuali.

Le variabili indispensabili sono:

- `AUTH_PEPPER` per le password;
- `AUTH_TOTP_ENCRYPTION_KEY` per i segreti 2FA;
- `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN` e `GARAGE_METRICS_TOKEN`;
- `GARAGE_S3_SECRET_ACCESS_KEY`;
- `OCR_LIFECYCLE_TOKEN`.

Per generare un segreto esadecimale da PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLowerInvariant()
```

Riportare in `garage/garage.local.toml` gli stessi valori usati per:

```toml
rpc_secret = "REPLACE_WITH_64_HEX_CHARS"
admin_token = "REPLACE_WITH_RANDOM_ADMIN_TOKEN"
metrics_token = "REPLACE_WITH_RANDOM_METRICS_TOKEN"
```

`BIRGUS_DEVELOPER_EMAIL` serve solo durante l'aggiornamento di vecchie installazioni con piu' account `superadmin`. In una nuova installazione puo' restare vuota.

`GARAGE_S3_ACCESS_KEY_ID` deve iniziare con `GK` e continuare con 24 caratteri esadecimali. La chiave segreta S3 puo' essere generata con la stessa procedura usata per gli altri segreti.

## 3. Configurare il provider AI

Birgus usa un provider compatibile con le API OpenAI. Se il provider gira su un altro computer della rete:

```dotenv
AI_PROVIDER=vllm
AI_PROVIDER_BASE_URL=http://192.168.1.100:8000/v1
AI_PROVIDER_API_KEY=
AI_PROVIDER_CHAT_MODEL=nome-modello
```

L'applicazione puo' essere installata anche prima che il provider AI sia disponibile. Le funzioni che lo richiedono resteranno inattive o segnaleranno che il servizio non e' raggiungibile.

## 4. Avviare i container

Controllare la configurazione e avviare lo stack:

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

Al primo avvio vengono creati il database, l'estensione pgvector, il catalogo dei ruoli, i permessi e i moduli. Non vengono creati utenti o workspace automaticamente.

Attendere che `birgus_app`, `birgus_frontend`, `birgus_pg` e `birgus_garage` risultino `healthy`. Il primo avvio dell'OCR può richiedere alcuni minuti per il download dei modelli.

Verifica backend:

```bash
curl http://localhost:13001/health
```

In PowerShell si può usare:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:13001/health
```

## 5. Inizializzare Garage

Garage richiede un layout, una chiave S3 e un bucket al primo avvio. Mostrare l'identificativo del nodo:

```bash
docker compose exec garage /garage status
```

Copiare l'ID mostrato nella sezione `HEALTHY NODES`, scegliere una capacità compatibile con il disco e applicare il primo layout:

```bash
docker compose exec garage /garage layout assign <NODE_ID> --zone local --capacity 10GB
docker compose exec garage /garage layout apply --version 1
```

Importare le credenziali presenti in `.env`, creare il bucket e concedere i permessi. Sostituire i valori tra parentesi angolari prima di eseguire i comandi:

```bash
docker compose exec garage /garage key import <GARAGE_S3_ACCESS_KEY_ID> <GARAGE_S3_SECRET_ACCESS_KEY> --yes
docker compose exec garage /garage bucket create <GARAGE_S3_BUCKET>
docker compose exec garage /garage bucket allow --read --write --owner <GARAGE_S3_BUCKET> --key <GARAGE_S3_ACCESS_KEY_ID>
```

Verificare il risultato:

```bash
docker compose exec garage /garage layout show
docker compose exec garage /garage key list
docker compose exec garage /garage bucket list
```

Questa procedura va eseguita una sola volta. Su un'installazione esistente con layout, chiave e bucket già presenti non deve essere ripetuta.

## 6. Creare il primo workspace

Il primo account riceve il ruolo `Developer`. Questo ruolo è unico, ha accesso globale e richiede obbligatoriamente la 2FA.

Esempio di installazione:

```bash
docker compose exec app npm run instance:initialize -- \
  --organization-code azienda \
  --organization-name "Azienda" \
  --workspace-code principale \
  --workspace-name "Workspace principale" \
  --email developer@example.com \
  --first-name Developer \
  --password "PasswordTemporanea1" \
  --modules "project_management,commission_registry,commission_intake,customer_map,superadmin_center"
```

Da PowerShell lo stesso comando puo' essere scritto su una sola riga:

```powershell
docker compose exec app npm run instance:initialize -- --organization-code azienda --organization-name "Azienda" --workspace-code principale --workspace-name "Workspace principale" --email developer@example.com --first-name Developer --password "PasswordTemporanea1" --modules "project_management,commission_registry,commission_intake,customer_map,superadmin_center"
```

Il comando funziona solo su un database senza workspace attivi e senza un Developer. La password temporanea deve contenere almeno otto caratteri, una lettera maiuscola e un numero.

## 7. Primo accesso

Aprire `http://IP_DEL_SERVER/` oppure `http://localhost/` se il browser si trova sul server.

Al primo accesso:

1. usare l'email e la password temporanea;
2. scegliere una nuova password;
3. configurare la 2FA con un'app TOTP;
4. conservare in modo sicuro le credenziali dell'account Developer.

Dal menu **Gestione workspace** si possono creare utenti, assegnare ruoli e attivare gli altri moduli.

## Ruoli iniziali

| Ruolo | Ambito | 2FA |
| --- | --- | --- |
| Developer | Intera installazione | Obbligatoria |
| Superuser | Gestione completa del proprio workspace | Facoltativa |
| Admin | Operazioni amministrative del workspace | Facoltativa |
| Guest | Operazioni applicative assegnate | Facoltativa |

## vLLM sullo stesso server

Compilare `vllm/runtime.env`, impostare `VLLM_LIFECYCLE_TOKEN` in `.env` e avviare il profilo dedicato:

```bash
docker compose --profile ai-runtime up -d --build
```

Il profilo richiede Docker con accesso alla GPU NVIDIA.

## HTTPS

Per un dominio raggiungibile dal server:

```bash
cp Caddyfile.https.example Caddyfile.https.local
```

Impostare in `.env`:

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

Lo stack standard esegue immagini stabili. Per montare i sorgenti e abilitare il reload automatico:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Frontend: `http://localhost:13100`  
Backend: `http://localhost:13001`  
Health check: `http://localhost:13001/health`
