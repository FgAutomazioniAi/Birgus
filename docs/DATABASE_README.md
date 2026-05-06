### Linee guida per db 

### `MembershipStatus`
Stato appartenenza utente-workspace:
- `INVITED`
- `ACTIVE`
- `SUSPENDED`

### `ModuleOverrideMode`
Modalita override modulo utente:
- `ALLOW`
- `DENY`

### `DocumentScope`
Ambito logico documento:
- `WORKSPACE`
- `PROJECT`
- `SHIPMENT`
- `DDT`
- `OTHER`

### `DdtDocumentStatus`
Stato documento DDT:
- `UPLOADED`
- `QUEUED`
- `OCR_PROCESSING`
- `AI_PROCESSING`
- `READY`
- `ERROR`

### `DdtJobStatus`
Stato job pipeline DDT:
- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `CANCELED`

## Tenant e anagrafiche di accesso

### Tabella `organizations`
Descrizione:
- tenant di primo livello

Colonne chiave:
- `id` (UUID, PK)
- `code` (univoco)
- `legal_name`
- `vat_number` (opzionale)
- timestamp standard + `deleted_at`

Connessioni:
- 1:N con `workspaces` (`workspaces.organization_id -> organizations.id`)

### Tabella `workspaces`
Descrizione:
- Tenant effettivo

Colonne chiave:
- `id` (UUID, PK)
- `organization_id` (FK)
- `code` (univoco per organization)
- `name`, `timezone`, `locale`, `is_active`

Connessioni principali:
- N:1 con `organizations`
- 1:N con quasi tutti i domini: utenti membership, moduli, archiviazione, ...

Vincoli:
- `@@unique([organization_id, code])`

### Tabella `users`
Descrizione:
- account applicativi globali

Colonne chiave:
- `id` (UUID, PK)
- `email` (univoco)
- `password_hash`, `password_updated_at`
- `is_active`

Connessioni principali:
- 1:N con `workspace_memberships`
- 1:N con `user_workspace_roles`
- 1:N con `auth_sessions`
- 1:N con `password_reset_codes`
- 1:N con `user_preferences`
- referenze su owner in più domini (projects, shipments, ddt, notifications, ..)

### Tabella `workspace_memberships`
Descrizione:
- relazione utente-workspace

Colonne chiave:
- `workspace_id` (FK)
- `user_id` (FK)
- `status`, `joined_at`, `left_at`

Connessioni:
- N:1 con `workspaces`
- N:1 con `users`

Vincoli:
- `@@unique([workspace_id, user_id])`

### Tabella `roles`
Descrizione:
- ruoli

Connessioni:
- 1:N con `role_permissions`
- 1:N con `user_workspace_roles`

### Tabella `permissions`
Descrizione:
- permessi (azioni)

Connessioni:
- 1:N con `role_permissions`

### Tabella `role_permissions`
Descrizione:
- tabella ponte M:N tra ruoli e permessi

Connessioni:
- N:1 con `roles`
- N:1 con `permissions`

Vincoli:
- `@@unique([role_id, permission_id])`

### Tabella `user_workspace_roles`
Descrizione:
- assegnazione ruoli a un utente dentro uno specifico workspace

Connessioni:
- N:1 con `workspaces`
- N:1 con `users`
- N:1 con `roles`

Vincoli:
- `@@unique([workspace_id, user_id, role_id])`

### Tabella `auth_sessions`
Descrizione:
- sessioni/token autenticazione utente

Colonne chiave:
- `token_hash` (univoco)
- `expires_at`, `revoked_at`

Connessioni:
- N:1 con `users` (`onDelete: Cascade`)

### Tabella `password_reset_codes`
Descrizione:
- codici reset password

Connessioni:
- N:1 con `users` (`onDelete: Cascade`)

### Tabella `user_preferences`
Descrizione:
- preferenze UI utente

Colonne chiave:
- `palette_id`, `language_code`
- `rows_projects`, `rows_clients`, `rows_shipments`
- `columns_projects`, `columns_clients`, `columns_shipments`

Note:
- conserva le preferenze delle tabelle principali del frontend
- ora include anche righe/colonne personalizzate per la vista tabellare delle spedizioni

Connessioni:
- N:1 con `users` (`onDelete: Cascade`)
- N:1 opzionale con `workspaces` (`onDelete: SetNull`)

Vincoli:
- `@@unique([user_id, workspace_id])`

## Moduli e feature toggles

### Tabella `modules`
Descrizione:
- catalogo moduli funzionali (es. project_management, ddt_processing, agent_management, document_intelligence, conversational_assistant, ...)

Colonne chiave:
- `key` (univoco)
- `name`, `description`
- `is_core`, `is_active`

Connessioni:
- 1:N con `workspace_modules`
- 1:N con `user_module_overrides`
- 1:N con `module_dependencies`
- referenza opzionale da `documents`, `notifications`, `audit_logs`

### Tabella `module_dependencies`
Descrizione:
- dipendenze tra moduli

Connessioni:
- N:1 con `modules` (modulo)
- N:1 con `modules` (modulo dipendenza)

Vincoli:
- `@@unique([module_id, depends_on_module_id])`

### Tabella `workspace_modules`
Descrizione:
- stato modulo a livello workspace ( on / off )

Colonne chiave:
- `workspace_id`, `module_id`
- `is_enabled`
- `configured_by_user_id`, `configured_at`

Connessioni:
- N:1 con `workspaces`
- N:1 con `modules`
- N:1 opzionale con `users`

Vincoli:
- `@@unique([workspace_id, module_id])`

### Tabella `user_module_overrides`
Descrizione:
- override per singolo utente dentro workspace

Colonne chiave:
- `workspace_id`, `user_id`, `module_id`
- `mode` (`ALLOW`/`DENY`)
- `reason`

Connessioni:
- N:1 con `workspaces`
- N:1 con `users` (target override)
- N:1 con `modules`
- N:1 opzionale con `users` (configured_by_user_id)

Vincoli:
- `@@unique([workspace_id, user_id, module_id])`

## Archiviazione documenti

### Tabella `file_types`
Descrizione:
- catalogo tipo file (chiave logica, mime)

Connessioni:
- 1:N con `documents`

### Tabella `file_statuses`
Descrizione:
- stato del file 

Connessioni:
- 1:N con `documents`

### Tabella `nodes`
Descrizione:
- albero logico cartelle/nodi per workspace

Colonne chiave:
- `workspace_id`
- `parent_id` (self FK)
- `name`, `path_cache`, `depth`

Connessioni:
- N:1 con `workspaces`
- N:1 self su `parent_id`
- 1:N self su `children`
- 1:N con `documents`

Vincoli:
- `@@unique([workspace_id, path_cache])`

### Tabella `documents`
Descrizione:
- metadati documento; contenuto fisico su object storage (`storage_path`, es. `garage://...`)

Colonne chiave:
- `workspace_id`, `node_id`
- `file_type_id`, `file_status_id`
- `module_id` opzionale
- `scope`, `domain_entity_type`, `domain_entity_id`
- `filename`, `size_bytes`, `storage_path`, `checksum_sha256`
- `uploaded_by_user_id`

Connessioni:
- N:1 con `workspaces`
- N:1 con `nodes`
- N:1 con `file_types`
- N:1 con `file_statuses`
- N:1 opzionale con `modules`
- N:1 opzionale con `users` (uploader)
- 1:1 opzionale inversa con `ddt_documents`


## Rubrica clienti e aziende

### Tabella `companies`
Descrizione:
- aziende/anagrafiche societarie per workspace

Connessioni:
- N:1 con `workspaces`
- 1:N con `clients`

### Tabella `clients`
Descrizione:
- clienti (persona/contatto)

Connessioni:
- N:1 con `workspaces`
- N:1 opzionale con `companies`
- 1:N con `project_clients`
- 1:N con `project_versions`
- 1:N con `shipments`

## Modulo Progetti

### Tabella `project_statuses`
Descrizione:
- stati progetto/versione per workspace

Connessioni:
- N:1 con `workspaces`
- 1:N con `projects`
- 1:N con `project_versions`

Vincoli:
- `@@unique([workspace_id, key])`

### Tabella `project_revisions`
Descrizione:
- revisione/codice revisione progetto

Connessioni:
- N:1 con `workspaces`
- 1:N con `projects`

Vincoli:
- `@@unique([workspace_id, code])`

### Tabella `project_authors`
Descrizione:
- autori associabili ai progetti

Connessioni:
- N:1 con `workspaces`
- 1:N con `projects`

### Tabella `projects`
Descrizione:
- anagrafica progetto principale

Colonne chiave:
- `workspace_id`, `name`
- date (`publication_date`, `author_date`)
- `publisher_name`
- `owner_user_id`, `author_id`, `status_id`, `revision_id`

Connessioni:
- N:1 con `workspaces`
- N:1 opzionale con `users`
- N:1 opzionale con `project_authors`
- N:1 con `project_statuses`
- N:1 opzionale con `project_revisions`
- 1:N con `project_clients`
- 1:N con `project_agents`
- 1:N con `project_versions`

### Tabella `project_agents`
Descrizione:
- agenti configurati all'interno di un progetto
- contiene i dati del modulo agenti a livello di singolo progetto
- salva sia il prompt originale sia il prompt attualmente attivo

Colonne chiave:
- `workspace_id`, `project_id`
- `module_id`
- `key`
- `name`, `label`
- `original_prompt`, `active_prompt`
- `is_enabled`
- `created_by_user_id`, `updated_by_user_id`

Connessioni:
- N:1 con `workspaces`
- N:1 con `projects`
- N:1 con `modules`
- N:1 opzionale con `users` (creatore)
- N:1 opzionale con `users` (ultimo aggiornamento)

Vincoli:
- `@@unique([workspace_id, project_id, module_id, key])`

Note:
- `key` e' la chiave tecnica stabile dell'agente dentro il progetto
- `name` e' il nome interno associato all'agente
- `label` e' la dicitura da visualizzare in interfaccia
- `is_enabled` permette di attivare/disattivare il singolo agente senza cancellarlo
- `module_id` collega formalmente l'agente al modulo funzionale in cui verra richiamato
- il modulo di visualizzazione/configurazione agenti puo vivere separatamente nel catalogo moduli, restando governato da `modules`, `workspace_modules` e `user_module_overrides`

### Tabella `project_clients`
Descrizione:
- tabella ponte tra progetto e clienti (M:N)

Connessioni:
- N:1 con `workspaces`
- N:1 con `projects`
- N:1 con `clients`

Vincoli:
- `@@unique([workspace_id, project_id, client_id])`

### Tabella `project_versions`
Descrizione:
- versioni del progetto (v1, v2, ecc.)
- ogni versione rappresenta anche l'unita operativa a cui viene associata una singola spedizione

Colonne chiave:
- `workspace_id`, `project_id`
- `version_label`, `description`
- `client_id`, `status_id`
- `is_default`

Connessioni:
- N:1 con `workspaces`
- N:1 con `projects`
- N:1 opzionale con `clients`
- N:1 opzionale con `project_statuses`
- 1:1 opzionale con `shipments`

Vincoli:
- `@@unique([workspace_id, project_id, version_label])`

## Modulo Spedizioni

### Tabella `shipment_statuses`
Descrizione:
- stati di spedizione per workspace

Connessioni:
- N:1 con `workspaces`
- 1:N con `shipments`
- 1:N con `shipment_events`

Vincoli:
- `@@unique([workspace_id, key])`

### Tabella `shipments`
Descrizione:
- testata spedizione
- ogni spedizione e' collegata a una singola versione progetto
- il record rappresenta la testata gestionale della spedizione, mentre i dati tecnici/calcolati sono salvati nella tabella dedicata `shipment_specifications`

Colonne chiave:
- `workspace_id`, `code`
- `project_version_id`
- `client_id`, `status_id`
- `scheduled_date`, `shipped_at`, `delivered_at`
- `created_by_user_id`, `notes`

Connessioni:
- N:1 con `workspaces`
- N:1 con `project_versions`
- N:1 opzionale con `clients`
- N:1 con `shipment_statuses`
- N:1 opzionale con `users`
- 1:1 opzionale con `shipment_specifications`
- 1:N con `shipment_items`
- 1:N con `shipment_events`

Vincoli:
- `@@unique([workspace_id, code])`
- `@@unique([project_version_id])`

Note:
- il vincolo univoco su `project_version_id` implementa la regola applicativa `1 versione = 1 spedizione`

### Tabella `shipment_specifications`
Descrizione:
- dettaglio tecnico della spedizione
- salva in forma JSON sia i dati di input sia i risultati calcolati del configuratore spedizioni frontend

Colonne chiave:
- `workspace_id`
- `shipment_id`
- `input_payload`
- `calculation_payload`

Connessioni:
- N:1 con `workspaces`
- 1:1 con `shipments` (`onDelete: Cascade`)

Vincoli:
- `@@unique([shipment_id])`

### Tabella `shipment_items`
Descrizione:
- righe articolo spedizione

Connessioni:
- N:1 con `shipments` (`onDelete: Cascade`)

### Tabella `shipment_events`
Descrizione:
- timeline eventi spedizione

Connessioni:
- N:1 con `shipments` (`onDelete: Cascade`)
- N:1 opzionale con `shipment_statuses`
- N:1 opzionale con `users`

## Modulo DDT Reader

### Tabella `ddt_documents`
Descrizione:
- entita DDT collegata 1:1 a un record `documents`

Colonne chiave:
- `workspace_id`
- `document_id` (univoco)
- `status`, `original_filename`, `last_error`
- `requested_by_user_id`

Connessioni:
- N:1 con `workspaces`
- 1:1 con `documents`
- N:1 opzionale con `users`
- 1:1 con `ddt_analysis_results`
- 1:N con `ddt_processing_jobs`
- 1:N con `ddt_processing_events`

### Tabella `ddt_analysis_results`
Descrizione:
- risultato analisi DDT

Connessioni:
- 1:1 con `ddt_documents` (`onDelete: Cascade`)
- 1:N con `ddt_article_items`

### Tabella `ddt_article_items`
Descrizione:
- righe articoli estratti dal DDT

Connessioni:
- N:1 con `ddt_analysis_results` (`onDelete: Cascade`)

### Tabella `ddt_processing_jobs`
Descrizione:
- job pipeline di lavorazione DDT

Connessioni:
- N:1 con `workspaces`
- N:1 con `ddt_documents` (`onDelete: Cascade`)
- 1:N con `ddt_processing_events`

### Tabella `ddt_processing_events`
Descrizione:
- eventi dei job DDT

Connessioni:
- N:1 con `ddt_processing_jobs` (`onDelete: Cascade`)
- N:1 con `ddt_documents` (`onDelete: Cascade`)

## Assistente conversazionale e document intelligence

### Tabella `assistant_sessions`
Descrizione:
- sessioni chat limitate al ticket/conversazione aperta dall'utente
- conserva anche il contesto applicativo collegato, quando presente

Colonne chiave:
- `workspace_id`
- `opened_by_user_id`
- `module_id`
- `status`
- `context_entity_type`, `context_entity_id`
- `project_id`, `project_version_id`, `client_id`, `shipment_id`, `document_id`, `ddt_document_id`
- `opened_at`, `last_activity_at`, `closed_at`

Connessioni:
- N:1 con `workspaces`
- N:1 opzionale con `users`
- N:1 opzionale con `modules`
- N:1 opzionale con `projects`
- N:1 opzionale con `project_versions`
- N:1 opzionale con `clients`
- N:1 opzionale con `shipments`
- N:1 opzionale con `documents`
- N:1 opzionale con `ddt_documents`
- 1:N con `assistant_messages`
- 1:N con `assistant_tool_calls`
- 1:N con `assistant_memory_snapshots`

### Tabella `assistant_messages`
Descrizione:
- messaggi scambiati durante la sessione chat
- memorizza sia testo puro sia payload JSON ausiliari

Colonne chiave:
- `session_id`, `workspace_id`
- `role`
- `sequence_no`
- `content_text`, `content_payload`
- `model_name`
- `prompt_tokens`, `completion_tokens`

Connessioni:
- N:1 con `assistant_sessions` (`onDelete: Cascade`)
- N:1 con `workspaces`
- N:1 opzionale con `users` (autore umano)
- 1:N con `assistant_tool_calls`

Vincoli:
- `@@unique([session_id, sequence_no])`

### Tabella `assistant_tool_calls`
Descrizione:
- audit esecutivo delle funzioni backend chiamate dal chatbot
- conserva argomenti, risultato e contesto autorizzativo

Colonne chiave:
- `session_id`, `message_id`, `workspace_id`
- `module_id`
- `tool_name`
- `status`
- `arguments_payload`, `result_payload`, `authorization_context`
- `denied_reason`

Connessioni:
- N:1 con `assistant_sessions` (`onDelete: Cascade`)
- N:1 opzionale con `assistant_messages`
- N:1 con `workspaces`
- N:1 opzionale con `modules`

### Tabella `assistant_memory_snapshots`
Descrizione:
- memoria compatta derivata dalla conversazione
- permette riassunti progressivi senza rileggere tutti i messaggi

Colonne chiave:
- `session_id`, `workspace_id`
- `summary_text`
- `extracted_facts`
- `message_count`, `token_estimate`
- `generated_at`

Connessioni:
- N:1 con `assistant_sessions` (`onDelete: Cascade`)
- N:1 con `workspaces`

### Tabella `knowledge_documents`
Descrizione:
- layer documentale/logico per contenuti interrogabili dal chatbot
- puo rappresentare documenti Garage, testi OCR, riassunti o payload strutturati

Colonne chiave:
- `workspace_id`
- `module_id`, `document_id`
- `source_entity_type`, `source_entity_id`
- `representation_key`
- `content_text`, `summary_text`, `structured_payload`
- `extraction_status`, `extraction_kind`
- `content_hash`, `last_error`, `extracted_at`

Connessioni:
- N:1 con `workspaces`
- N:1 opzionale con `modules`
- N:1 opzionale con `documents`
- 1:N con `knowledge_chunks`

Vincoli:
- `@@unique([workspace_id, source_entity_type, source_entity_id, representation_key])`

Note:
- questa tabella e un layer intermedio controllato tra archivio documentale e chatbot
- evita accesso diretto del modello ai file o alle tabelle operative

### Tabella `knowledge_chunks`
Descrizione:
- suddivisione semantica dei contenuti interrogabili
- pronta per embedding e ricerca semantica per chunk

Colonne chiave:
- `workspace_id`
- `knowledge_document_id`
- `chunk_index`
- `content_text`
- `embedding_status`
- `embedding_provider`, `embedding_model`, `embedding_dimensions`
- `embedding_payload`
- `metadata`, `embedded_at`

Connessioni:
- N:1 con `workspaces`
- N:1 con `knowledge_documents` (`onDelete: Cascade`)

Vincoli:
- `@@unique([knowledge_document_id, chunk_index])`

Nota infrastrutturale:
- il database attuale non espone ancora l'estensione PostgreSQL `pgvector`
- per questo il vettore e predisposto ora tramite metadata/`embedding_payload`
- quando verra introdotta l'estensione a livello Docker/Postgres, `knowledge_chunks` e il punto naturale dove aggiungere la colonna `vector`

## Notifiche e logs

### Tabella `notifications`
Descrizione:
- notifiche applicative per workspace/utente

Connessioni:
- N:1 con `workspaces`
- N:1 opzionale con `users`
- N:1 opzionale con `modules`

### Tabella `audit_logs`
Descrizione:
- log azioni auditable

Colonne chiave:
- `action`, `entity_type`, `entity_id`
- `payload`, `ip_address`, `user_agent`

Connessioni:
- N:1 con `workspaces`
- N:1 opzionale con `users`
- N:1 opzionale con `modules`

## Mappa connessioni ad alto livello

- `organizations` 1:N `workspaces`
- `workspaces` 1:N su quasi tutti i domini
- `users` M:N `workspaces` tramite `workspace_memberships`
- `users` M:N `roles` per workspace tramite `user_workspace_roles`
- `roles` M:N `permissions` tramite `role_permissions`
- `modules` M:N (dipendenze) su se stessa tramite `module_dependencies`
- `workspaces` M:N `modules` tramite `workspace_modules`
- `users` + `modules` con override per workspace tramite `user_module_overrides`
- `nodes` gerarchico self-reference + `documents`
- `projects` M:N `clients` tramite `project_clients`
- `projects` 1:N `project_agents`
- `project_versions` 1:1 `shipments`
- `shipments` 1:1 `shipment_specifications`
- `ddt_documents` 1:1 `documents`
- `assistant_sessions` 1:N `assistant_messages`
- `assistant_sessions` 1:N `assistant_tool_calls`
- `assistant_sessions` 1:N `assistant_memory_snapshots`
- `knowledge_documents` 1:N `knowledge_chunks`

## Multi-tenant

Ogni query applicativa deve essere filtrata per `workspace_id` quando la tabella lo prevede

## Soft delete

Le tabelle con `deleted_at` richiedono filtro `deleted_at IS NULL`
