# Birgus Platform (Modular OOP)

Backend modulare multi-tenant costruito da DEMO con separazione netta:
- `core`
- `modules`
- `storage`
- `worker`
- `database`

## Stack
- TypeScript
- Fastify
- Prisma + PostgreSQL
- Garage (S3-compatible)

## Avvio locale
```bash
npm install
cd frontend && npm install && cd ..
cp .env.example .env
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
npm run dev:frontend
```

Server API: `http://localhost:3000`
Frontend legacy (Next): `http://localhost:3100`
Health: `GET /health`

## Avvio Docker
```bash
docker compose up --build -d
```

Servizi:
- API app: `http://localhost:3000`
- Frontend legacy Next: `http://localhost:3100`
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
- `GET /api/shipments`
- `POST /api/shipments`
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

## Seed iniziale
Utente seed:
- email: `superuser@birgus.it`
- password: `admin`

Il seed crea organization/workspace, ruoli, permessi, moduli, status base e associazioni iniziali.

## Stato corrente
- Architettura OOP modulare attiva
- Worker DDT integrato nel processo app (queue in-memory)
- Pipeline DDT analyzer in modalità stub (punto di estensione per OCR/AI reale)
