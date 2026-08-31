# Birgus Platform

Backend modulare multi-tenant:
- `core`
- `modules`
- `storage`
- `worker`
- `database`

## Stack
- TypeScript
- NestJS + Fastify
- Prisma + PostgreSQL
- Garage (S3-compatible)

## Avvio locale
```bash
npm install
cd frontend && npm install && cd ..
cp .env.example .env
cp garage/garage.toml.example garage/garage.local.toml
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
npm run dev:frontend
```

Server API: `http://localhost:3000`
Frontend Next: `http://localhost:3100`
Health: `GET /health`

## Avvio Docker
```bash
docker compose up --build -d
```

Servizi:
- API app: `http://localhost:3000`
- Frontend Next: `http://localhost:3100`
- PostgreSQL: `localhost:5432`
- Garage S3 API: `http://localhost:3900`
- Garage Admin API: `http://localhost:3903`

Nota: il container `app` esegue `db:push` + `db:seed` all'avvio.

## Endpoint principali
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`
- `GET /api/modules`
- `POST /api/modules/:moduleKey/enable`
- `POST /api/modules/:moduleKey/disable`
- `GET /api/modules/users/:userId`
- `POST /api/modules/users/:userId/:moduleKey/allow`
- `POST /api/modules/users/:userId/:moduleKey/deny`
- `DELETE /api/modules/users/:userId/:moduleKey/override`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `GET /api/projects/:projectId/versions`
- `POST /api/projects/:projectId/versions`
- `PATCH /api/projects/:projectId/versions` (compat frontend storico)
- `DELETE /api/projects/:projectId/versions` (compat frontend storico)
- `PATCH /api/projects/:projectId/versions/default`
- `DELETE /api/projects/:projectId/versions/:versionLabel`
- `GET /api/projects/:projectId/files`
- `GET /api/projects/:projectId/files/:fileKind`
- `POST /api/projects/:projectId/files/:fileKind`
- `DELETE /api/projects/:projectId/files/:fileKind`
- `GET /api/projects/:projectId/files/:fileKind/content`
- `GET /api/projects/:projectId/quotation`
- `POST /api/projects/:projectId/quotation` (multipart PDF)
- `DELETE /api/projects/:projectId/quotation`
- `GET /api/projects/:projectId/quotation/file`
- `POST /api/projects/:projectId/quotation/analyze`
- `GET /api/orchestrator/jobs/:jobId`
- `GET /api/clients`
- `POST /api/clients`
- `GET /api/clients/:clientId`
- `PATCH /api/clients/:clientId`
- `DELETE /api/clients/:clientId`
- `GET /api/user/preferences`
- `PATCH /api/user/preferences`
- `POST /api/ddt/documents/:documentId/analyze`
- `GET /api/ddt-reader/config`
- `GET /api/ddt-reader/documents`
- `POST /api/ddt-reader/documents` (multipart PDF)
- `GET /api/ddt-reader/documents/:id`
- `POST /api/ddt-reader/documents/:id/analyze`
- `DELETE /api/ddt-reader/documents/:id`
- `GET /api/ddt-reader/documents/:id/file`
- `GET /api/notifications`
- `PATCH /api/notifications` (compat frontend storico)
- `DELETE /api/notifications` (compat frontend storico)
- `PATCH /api/notifications/read-all`
- `POST /api/notifications`

## Headers richiesti
Per gli endpoint autenticati:
- `Authorization: Bearer <token>`
- `x-workspace-id: <workspace_uuid>`

Compatibilità frontend storico:
- cookie di sessione `vl_session` supportato automaticamente
- se `x-workspace-id` manca, viene risolto il workspace attivo primario dell'utente

## Modello autorizzativo
- Controllo `module` (workspace + override utente) per abilitazione funzionale.
- Controllo `permission` (ruolo workspace -> permessi) per autorizzazione azioni read/write.
- Le dipendenze tra moduli vengono validate quando abiliti/disabiliti un modulo.

## Inizializzazione
Il bootstrap Docker crea soltanto il catalogo tecnico: ruoli, permessi, moduli, dipendenze e tipi file. Non crea organization, workspace o utenti. Per una nuova installazione segui `docs/INSTALLATION_FROM_ZERO.md` e crea il primo superuser con `npm run instance:initialize`.

## Garage locale
Il file `garage/garage.local.toml` e richiesto da Docker Compose ma non deve essere versionato. Crealo da `garage/garage.toml.example` e sostituisci `rpc_secret`, `admin_token` e `metrics_token` con valori casuali per ogni ambiente.

## Stato corrente
- Architettura OOP modulare attiva
- Worker backend integrati nel processo app con queue Postgres-backed
- Pipeline OCR/IA collegata a provider OpenAI-compatible configurabile da `.env` (`AI_PROVIDER_*`, vLLM per MVP)

## vLLM gestito
Il modello gira come container separato, ma nello stesso Docker host dell'applicazione. Per abilitarlo imposta un token casuale non vuoto in `.env`:

```bash
VLLM_LIFECYCLE_TOKEN="token-locale-lungo-e-casuale"
```

Poi avvia il profilo IA:

```bash
docker compose --profile ai-runtime up -d --build
```

Il modulo `ai_runtime_control` e' disabilitato per default e va abilitato dal Superadmin per l'utente autorizzato. Da Impostazioni quell'utente puo' modificare `max_model_len`: il controller interno aggiorna solo `birgus_vllm` e ricrea solo quel container. L'app usa `http://vllm:8000/v1` nella rete Docker.
Per uno smoke test diretto:

```bash
AI_PROVIDER_BASE_URL="http://127.0.0.1:8000/v1" \
AI_PROVIDER_API_KEY="token-locale-lungo" \
AI_PROVIDER_CHAT_MODEL="birgus-vl" \
npm run ai:smoke
```

## Documentazione sicurezza
- Installazione pulita e primo superuser: `docs/INSTALLATION_FROM_ZERO.md`
- Librerie approvate: `docs/APPROVED_LIBRARIES.md`
- Coding style sicuro: `docs/CODING_STYLE_SECURITY.md`
- Eccezioni sicurezza: `docs/SECURITY_EXCEPTION_TEMPLATE.md`
- HTTPS finale: `docs/HTTPS_FINAL_STEP.md`

## Variabili ambiente auth/proxy
- `AUTH_COOKIE_NAME` (default `vl_session`)
- `AUTH_COOKIE_DOMAIN` (opzionale, utile con dominio custom)
- `AUTH_COOKIE_PATH` (default `/`)
- `AUTH_COOKIE_SECURE` (`true` in produzione HTTPS)
- `AUTH_COOKIE_SAME_SITE` (`Lax` default, supporta `Strict`/`None`)
- `TRUST_PROXY` (`true` se dietro reverse proxy)
