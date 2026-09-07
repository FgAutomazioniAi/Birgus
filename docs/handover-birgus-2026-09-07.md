# Birgus handover - 2026-09-07

Questo documento serve alla prossima chat per riprendere il progetto senza ricostruire tutto il contesto. Il workspace locale principale e' `C:\.PROGETTI\Birgus`. Il progetto e' una piattaforma modulare multi-workspace con backend Nest/Fastify, frontend Next.js, Prisma/PostgreSQL, Garage S3-compatible storage, servizi Python separati, OCR separato e provider AI OpenAI-compatible.

## Stato operativo

- Il working tree e' stato verificato pulito prima di creare questo handover.
- E' stata aggiunta `.gitattributes` per forzare `LF` su script shell, Dockerfile e file Compose/YAML, cosi' `scripts/docker-entrypoint.sh` non torna a rompersi su Docker Linux dopo modifiche da Windows.
- `.gitignore` ignorava `docs/*`; ora consente esplicitamente `docs/handover-*.md`, quindi questo documento puo' essere versionato.
- Problema remoto recente: su un altro PC Windows via SSH, `birgus_app` non partiva con `scripts/docker-entrypoint.sh: set: line 2: illegal option -`. Causa probabile: line ending/encoding dello script. La protezione corretta e' `.gitattributes` piu' rinormalizzazione/commit.
- Problema successivo risolto: `prisma db push` si fermava per data loss su residui Spedizioni (`shipment_statuses`, colonne `rows_shipments`/`columns_shipments`, enum `DocumentScope.SHIPMENT`) e `psql` falliva con `invalid URI query parameter: "schema"`. L'entrypoint ora rimuove il query param Prisma da `DATABASE_URL` per `psql` ed esegue sempre `scripts/decommission-shipments.sql` prima del push. Lo script e' idempotente e conserva `DocumentScope.COMMISSION_INTAKE`.

## Architettura runtime

- `docker-compose.yml` definisce:
  - `postgres`: `pgvector/pgvector:0.8.2-pg16`, porta host `15433`, DB `birgus`.
  - `garage`: object storage S3-compatible, porte host `13900`, `13901`, `13903`.
  - `python_modules`: moduli Python generici, esposto internamente su `8200`.
  - `ocr_engine`: servizio OCR Paddle separato, esposto internamente su `8201`, storage in `ocr_service/storage`.
  - `ocr_lifecycle`: servizio interno su `8202` che gestisce il ciclo vita del container OCR tramite Docker socket.
  - `vllm` e `vllm_lifecycle`: profilo opzionale `ai-runtime`; vLLM espone `8000`.
  - `app`: backend Node/Nest/Fastify, porta host `13001`, healthcheck `/health`.
  - `frontend`: Next.js, porta host `13100`, proxy verso `app:3000`.
  - `reverse_proxy`: Caddy, porta host `80`, proxy verso frontend/backend.
- URL comodi:
  - senza proxy: `http://<ip-server>:13100`
  - con Caddy/DNS: `http://local.birgus.ai` o dominio configurato su porta `80`.

## Comandi utili

```powershell
git status --short
git pull
docker compose up -d --build
docker compose ps
docker logs -f birgus_app
docker logs -f birgus_frontend
docker compose exec app npm run db:bootstrap
docker compose exec app npm run db:sync:workflow-tools
docker compose exec app npm run instance:snapshot
docker compose exec app npm run typecheck
docker compose exec app npm test
docker compose exec app npm run build:frontend
docker compose exec app npm run security:check
```

Per controllare i line ending dello script di entrypoint:

```powershell
git ls-files --eol scripts/docker-entrypoint.sh
```

Il risultato atteso e' `i/lf w/lf attr/text eol=lf`.

## Bootstrap e installazione

- La guida di installazione da zero e' in `docs/INSTALLATION_FROM_ZERO.md`.
- L'app non deve assumere workspace o superuser preesistenti in una installazione pulita.
- Primo setup:
  - `docker compose up -d --build`
  - `docker compose exec app npm run instance:initialize -- ...`
  - poi `docker compose exec app npm run db:sync:workflow-tools`
- `instance:initialize` crea organizzazione, workspace, primo superuser, moduli scelti e snapshot del profilo installato.
- `db:bootstrap` e `db:seed` puntano a `scripts/bootstrap-database.ts`; non dovrebbero cancellare dati utente normali. Sincronizzano cataloghi tecnici, permessi, moduli, template e nodi.
- `BIRGUS_SEED_PASSWORD` non deve piu' essere necessario per il normale bootstrap moderno; se compare ancora quell'errore, verificare che il container stia usando l'ultima versione del codice e rebuildare `app`.

## Moduli e accesso

- I moduli sono gestiti da DB con attivazione workspace e override utente.
- Il backend deve sempre controllare il workspace, non solo la UI.
- File principali:
  - `src/core/module-access/ModuleKey.ts`
  - `src/core/module-access/ModuleAccessPolicy.ts`
  - `src/modules/module-management/`
  - `src/modules/module-management/domain/ModuleActivationGroups.ts`
  - `scripts/bootstrap-database.ts`
  - `scripts/initialize-instance.ts`
  - `scripts/installation-profile.ts`
  - `scripts/snapshot-installation-profile.ts`
- La UI Superadmin deve permettere gestione moduli sia per utenti sia per workspace. L'effettivo utente dipende dal modulo abilitato nel workspace piu' eventuale override utente.
- L'AI va considerata una capability sempre centrale: oggi vLLM/OpenAI-compatible, domani Brainyware o OpenAI API. Evitare sovrapposizioni di archivio/knowledge quando Brainyware verra' integrato.

## Moduli disponibili

- `project_management`
- `agent_management`
- `ddt_processing`
- `measure_report`
- `document_archive`
- `document_intelligence`
- `conversational_assistant`
- `ai_runtime_control`
- `workflow_management`
- `commission_registry`
- `commission_intake`
- `customer_map`
- `offer_priority`
- `maintenance_proposals`
- `maintenance_calendar`
- `notification_center`
- `audit_center`
- `superadmin_center`

Nota: il gruppo manutenzione/offerte (`maintenance_calendar`, `maintenance_proposals`, `offer_priority`) e' concettualmente abilitato insieme. `project_management` non deve dipendere da agenti o workflow.

## Workflow

- File backend principali:
  - `src/modules/workflows/`
  - `src/modules/workflows/services/WorkflowRunExecutorService.ts`
  - `src/modules/workflows/services/WorkflowGraphPlanner.ts`
  - `src/modules/workflows/services/WorkflowRuntimeAccessPolicy.ts`
  - `src/modules/workflows/services/WorkflowRuleEngine.ts`
  - `src/modules/workflows/services/HumanInterventionService.ts`
  - `src/modules/workflows/services/WorkflowTransferService.ts`
  - `scripts/sync-workflow-tools.ts`
- Nodi standard attuali:
  - `langchain_compose_email`
  - `langchain_format_text`
  - `workflow_format_template`
  - `workflow_verify_and_route`
  - `workflow_request_decision`
- Il nodo `workflow_request_decision` sostituisce il vecchio concetto di revisione umana generica: sospende la run e richiede decisione esplicita.
- `workflow_verify_and_route` deve essere chiaro all'utente: ingressi espliciti, output V/F, niente JSON tecnico da scrivere a mano.
- `AI Chat` deve aggregare correttamente piu' input, non usare solo il primo testo utile.
- Import/export workflow deve validare i moduli consentiti a livello workspace.

## Chatbot e AI provider

- Runtime AI in:
  - `src/modules/ai-runtime/`
  - `src/modules/conversational-assistant/`
  - `src/modules/document-intelligence/`
- Provider vLLM configurato come OpenAI-compatible. Il nome UI desiderato e' `Internal AI - vLLM`.
- Se Birgus e vLLM girano sullo stesso host Docker ma vLLM e' container esterno pubblicato su host, base URL tipico da container app: `http://internal-ai-vllm:8000/v1`, grazie a `extra_hosts`.
- Se vLLM e' su altro PC LAN, usare `http://<ip>:8000/v1`.
- Output chatbot limitato a 2048 token va bene. La ricerca knowledge deve restare scelta dall'utente, non automatica per euristiche sui messaggi brevi.
- Errore vLLM gia' visto: `max_tokens ... too large`. La richiesta non deve inviare `max_tokens` uguale all'intero context length; lasciare spazio per input e history.

## OCR

- OCR e' stato portato fuori da `python_modules` in `ocr_service`.
- `ocr_engine` consuma RAM quando e' su; il toggle OCR deve poter fermare realmente il container tramite `ocr_lifecycle`, non solo disabilitare la UI.
- Quando OCR viene riavviato serve feedback non bloccante finche' il servizio non e' pronto o non ha caricato i modelli.

## Archivio e knowledge

- Moduli principali:
  - `src/modules/document-archive/`
  - `src/modules/document-intelligence/`
- Vincolo deciso: se un documento viene eliminato dall'archivio, deve essere eliminato anche dalla knowledge AI collegata.
- Storage binari tramite Garage/S3; metadati su PostgreSQL.

## Autenticazione e sicurezza utenti

- Moduli:
  - `src/modules/identity/`
  - `src/modules/audit/`
  - `src/modules/preferences/`
- Sessione via cookie HTTP-only; durata configurabile con `AUTH_SESSION_HOURS` e remember con `AUTH_SESSION_REMEMBER_DAYS`.
- Password policy richiesta: minimo 8 caratteri, almeno una maiuscola e un numero.
- Codice monouso reset password: massimo 4 tentativi.
- Primo accesso utente creato da superuser: obbligo cambio password.
- 2FA per ora solo superuser.
- Login superuser: conferma auth/2FA deve funzionare anche premendo Enter.

## UI generale

- Esistono tema light e dark; dark usa logo black dove previsto.
- Lingua UI: switch IT/EN; continuare a completare traduzioni mancanti in `frontend/src/lib/language.ts`.
- Dashboard dopo login e' la landing personale:
  - accesso dalla parte alta sidebar con logo utente/nome utente.
  - header non deve avere bottone Dashboard.
  - area privata contiene interventi da gestire e workflow/moduli rapidi.
  - impostazioni personali sono separate dalle impostazioni Admin.
- Admin settings e personal settings non vanno mischiate.
- Header workflow: mostra fino a 5 run recenti con ora/minuti e stato.
- Mantenere il separatore verticale tra lista esecuzioni e switch lingua.

## Brainyware

- E' stata aggiunta una scheda workflow `Brainyware` con logo/placeholder non trascinabile.
- Brainyware e' in pausa: va trattato come secondo provider AI alternativo a vLLM, con propria knowledge/archivio/circuito chiuso. Quando si riprende, prima studiare API reali e decidere come non sovrapporre l'archivio Birgus con quello Brainyware.
- Asset citati:
  - `frontend/public/brainyware-logo.png`
  - `frontend/public/brainyware-logo-name.png`

## Commission registry e Checklist raccolta dati

Concetto corretto deciso con l'utente:

- Deve esistere una anagrafica commesse separata.
- La checklist si chiama `Checklist raccolta dati`, non "commesse".
- La checklist lista commessa + cliente + descrizione progetto, poi aprendo una riga si apre il form.
- L'anagrafica commesse e' di ausilio alla checklist, ma non e' lo stesso modulo.

File importanti:

- `prisma/schema.prisma`
- `prisma/commission-intake-template.ts`
- `prisma/commission-intake-template-snapshot.ts`
- `docs/commission-intake-schema.dbml`
- `Obsidian/Birgus data/Drafts/COMMISSION_INTAKE_DATABASE_SCHEMA.canvas`
- `Obsidian/Birgus data/Drafts/COMMISSION_INTAKE_DATABASE_SCHEMA.md`
- `src/modules/commission-intake/domain/CommissionRecordEntity.ts`
- `src/modules/commission-intake/repositories/CommissionIntakeRepository.ts`
- `src/modules/commission-intake/infra/PrismaCommissionIntakeRepository.ts`
- `src/modules/commission-intake/services/CommissionIntakeService.ts`
- `src/nest/commission-intake/commission-intake.controller.ts`
- `frontend/src/components/organisms/commission-records-panel.tsx`
- `frontend/src/components/organisms/data-collection-checklist-panel.tsx`
- `frontend/src/components/organisms/commission-detail-panel.tsx`
- `frontend/src/app/(app)/commesse/`
- `frontend/src/app/(app)/checklist-raccolta-dati/`
- `tests/commission-intake/commission-intake-service.test.ts`

Struttura form:

1. Informazioni generali progetto
2. Processo produttivo attuale
3. Prodotto/componente da lavorare
4. Obiettivi e requisiti automazione
5. Spazio e layout disponibile
6. Utilities e infrastrutture
7. Controllo, supervisione e integrazione IT
8. Visione artificiale e intelligenza artificiale
9. Robotica e manipolazione
10. Sicurezza e normative
11. Manutenzione e assistenza
12. Collaudo e validazione
13. Tempi e budget
14. Cybersecurity OT - Conformita' NIS2
15. Documentazione e allegati
16. Note e osservazioni

Regole UI/form decise:

- I 16 selettori numerici delle schede devono restare visibili. E' stato introdotto comportamento sticky quando lo switcher esce dalla vista, ma va verificato manualmente.
- I capitoli devono apparire come numeri; il titolo completo appare su hover.
- La firma e' l'ultimissimo passaggio, nella scheda 16. Il nome e' precompilato con l'utente firmante; resta solo la nota firma.
- Tutti i campi non devono essere obbligatori.
- Niente placeholder ripetitivi dove esiste gia' la label.
- Dove esiste unita' di misura, deve stare a destra della textbox, non nella label.
- Sì/No deve essere scelta esclusiva, non checkbox multiple.
- La scheda 14/15 documenti: NIS2 prima, Documentazione e allegati dopo.
- In Documentazione e allegati, ogni voce deve avere caricamento documento, senza checkbox.
- Se un caricamento e' condizionato da un Sì/No in altre schede, la scheda 14/15 deve mostrare chiaramente cosa manca o cosa e' gia' caricato.
- Popup salvataggio: deve indicare se mancano campi o allegati da completare. "Altro" vuoto non va contato.
- Admin puo' riaprire una checklist firmata; la nuova firma sovrascrive la precedente.

Backend checklist:

- Lock multiutente gestito dal backend/repository con `commissionResourceLock`; scopo: evitare modifiche concorrenti incoerenti.
- Event backlog/audit con `commissionEvent`.
- Permessi previsti: visualizzatore/modificatore, piu' admin per riapertura.
- Allegati multipli per field supportati lato backend e UI.
- Gli allegati creano documenti anche in archivio con scope `COMMISSION_INTAKE`.

Ultime verifiche note:

- `npm run typecheck` passato.
- `npm run build:frontend` passato.
- `npm test` passato.
- `npx prisma validate` passato.
- `npm run security:check` passato.
- Non e' stato fatto test browser completo dopo gli ultimi ritocchi UI; serve verifica visuale.

## Frontend dettagli checklist da ricontrollare

- Possibile scrollbar orizzontale a livello `<html>` vista in Chrome DevTools. Da verificare in `frontend/src/components/layout/app-shell.tsx` e nel layout di `commission-detail-panel.tsx`.
- `plasmo-csui` visto in DevTools non appartiene all'app: e' quasi certamente iniettato da estensioni browser.
- Tooltip titoli scheda 1 e 16 erano tagliati sul bordo; verificare posizionamento/clamp.
- Layout corrente richiesto: form centrale + pannello destro, con 16 selettori mantenuti.
- In `9.4 Vendor`, "marche di riferimento" deve stare come placeholder; serve "Altro" aggiungibile/rimuovibile; colonna "Altro" rinominata "Note".
- In `4.2`, formato simile al 9: categoria raggruppa valori, con Altro scrivibile, aggiungi/elimina ultima riga, priorita' come bottone ciclico bassa/media/alta.

## Dipendenze e hardening

- Prisma attuale nel `package.json`: `@prisma/client` e `prisma` `^6.19.3`.
- Override presenti:
  - `deepmerge-ts: 8.0.2`
  - `@fastify/static`
  - `js-yaml`
- Comandi:
  - `npm run audit:prod`
  - `npm run security:check`
  - `npm run check:mvp`
- Backup:
  - `npm run ops:backup`
  - Conservare fuori dal server dump PostgreSQL, dati Garage e `.env`/segreti necessari.

## Cose da non fare

- Non reintrodurre runtime dependency da file markdown per il form checklist. Il markdown puo' essere sorgente di progettazione, ma il software deve usare snapshot/codice/DB.
- Non eliminare dati utente con seed/bootstrap.
- Non mischiare Dashboard personale con Settings Admin.
- Non mostrare moduli/tool/nodi se non sono consentiti a livello workspace/capability.
- Non far scrivere agli utenti path JSON tecnici nei workflow.
- Non ripristinare Spedizioni se il modulo e' stato rimosso/deprecato.
- Se appaiono ancora warning Prisma su `shipment_*`, significa che il cleanup non e' stato eseguito dal codice aggiornato oppure il container `app` non e' stato rebuildato.

## Prossimo lavoro consigliato

1. Verificare con browser la checklist: scrollbar orizzontale, sticky selettore schede, tooltip, upload documenti su tutti gli slot, popup salvataggio.
2. Eseguire `docker compose up -d --build` su macchina Windows remota dopo commit/pull della `.gitattributes`.
3. Se serve rinormalizzare localmente:

```powershell
git add --renormalize .
git status --short
```

Poi committare solo le modifiche coerenti.

4. Consolidare Brainyware solo quando sono disponibili API certe.
5. Completare UI Superadmin per gestione workspace-moduli se non e' gia' chiusa.
