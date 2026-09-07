---
label: Checklist raccolta dati - schema database
status: draft
module: commission_intake
support_module: commission_registry
workflow: false
---

# Checklist raccolta dati - schema database

## Principio guida

Il modulo deve separare tre cose:

1. anagrafica commesse, cioe l'oggetto stabile che l'utente cerca e gestisce in un modulo separato;
2. definizione del form, cioe template, versioni, pagine, sezioni, campi, opzioni e tabelle;
3. compilazione del form, cioe valori, righe tabellari, allegati, firme, lock e storico modifiche.

Le 16 sezioni del documento non devono diventare 16 tabelle SQL. Devono diventare pagine/sezioni di un template versionato. Le tabelle SQL vanno create solo dove esiste un concetto stabile: commessa, template, campo, valore, allegato, permesso, lock, evento, firma, import.

## Collegamenti con database esistente

Si riusano le tabelle esistenti:

- `workspaces`: ogni commessa appartiene a un workspace.
- `users`: proprietari, editor, viewer, firmatari e autori modifiche.
- `companies`: azienda cliente, se presente.
- `clients`: referente cliente, se presente.
- `projects`: collegamento opzionale a progetto/documentazione gia esistente.
- `documents` e `nodes`: archivio documentale, senza creare un archivio parallelo.
- `knowledge_documents` e `knowledge_chunks`: indicizzazione AI eventuale degli allegati o del riepilogo commessa.
- `audit_logs`: audit globale applicativo.
- `notifications`: avvisi a utenti o workspace.
- `workspace_modules`: abilita/disabilita separatamente `commission_registry` e `commission_intake`.

## Tabelle nuove proposte

### 1. `commission_records`

Anagrafica commesse. E la base stabile del modulo `commission_registry` e la sorgente operativa usata da `commission_intake`.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk `workspaces.id`
- `code` text, numero commessa o codice interno
- `title` text, descrizione breve
- `description` text nullable, descrizione progetto
- `company_id` int nullable fk `companies.id`
- `client_id` uuid nullable fk `clients.id`
- `project_id` uuid nullable fk `projects.id`
- `customer_technical_contact` text nullable
- `plant_name` text nullable
- `department_or_line` text nullable
- `survey_date` date nullable
- `fg_reference_user_id` uuid nullable fk `users.id`
- `fg_reference_name` text nullable
- `status` enum/text: `DRAFT`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `SIGNED`, `ARCHIVED`, `CANCELLED`
- `priority` enum/text nullable: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- `target_installation_date` date nullable
- `target_production_start_date` date nullable
- `budget_band` text nullable
- `investment_state` text nullable
- `external_source_id` uuid nullable fk `commission_import_sources.id`
- `external_reference` text nullable
- `current_checklist_id` uuid nullable
- `owner_user_id` uuid nullable fk `users.id`
- `revision_no` int default 1
- `metadata` json nullable
- `created_at` datetime
- `updated_at` datetime
- `deleted_at` datetime nullable

Indici e vincoli:

- unique `workspace_id, code` dove `deleted_at is null`
- index `workspace_id, status`
- index `workspace_id, company_id`
- index `workspace_id, client_id`
- index `workspace_id, owner_user_id`
- index `workspace_id, target_installation_date`
- index `workspace_id, deleted_at`

Nota:

I campi qui sono quelli generici e utili in lista, ricerca, filtro e integrazioni. Il resto del documento resta nei valori dinamici.

### 2. `commission_record_contacts`

Contatti aggiuntivi della commessa, quando un solo `client_id` non basta.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `record_id` uuid fk `commission_records.id`
- `client_id` uuid nullable fk `clients.id`
- `role` text: `TECHNICAL`, `PRODUCTION`, `IT_OT_SECURITY`, `BUYER`, `MAINTENANCE`, `OTHER`
- `display_name` text
- `email` text nullable
- `phone` text nullable
- `notes` text nullable
- `created_at` datetime
- `updated_at` datetime
- `deleted_at` datetime nullable

### 3. `commission_form_templates`

Tipo di form riutilizzabile.

Campi:

- `id` uuid pk
- `workspace_id` uuid nullable fk `workspaces.id`
- `key` text
- `name` text
- `description` text nullable
- `scope` text: `SYSTEM`, `WORKSPACE`
- `is_enabled` boolean
- `created_by_user_id` uuid nullable
- `created_at` datetime
- `updated_at` datetime
- `deleted_at` datetime nullable

Vincoli:

- unique `workspace_id, key`

Nota:

Il template base "Checklist raccolta dati commessa" puo essere `SYSTEM`. Eventuali varianti per workspace possono essere `WORKSPACE`.

### 4. `commission_form_versions`

Versione immutabile pubblicata del template.

Campi:

- `id` uuid pk
- `template_id` uuid fk
- `version_no` int
- `status` text: `DRAFT`, `PUBLISHED`, `RETIRED`
- `source_document_title` text nullable
- `source_document_hash` text nullable
- `schema_hash` text
- `published_by_user_id` uuid nullable
- `published_at` datetime nullable
- `created_at` datetime
- `updated_at` datetime

Vincoli:

- unique `template_id, version_no`

Nota:

Una checklist compilata punta sempre a una versione precisa. Se in futuro cambiamo i campi, le vecchie compilazioni restano leggibili.

### 5. `commission_form_pages`

Pagine numerate del form, corrispondenti a `c1`, `c2`, ecc.

Campi:

- `id` uuid pk
- `version_id` uuid fk
- `page_no` int
- `title` text
- `description` text nullable
- `order_index` int
- `is_required` boolean
- `created_at` datetime

Vincoli:

- unique `version_id, page_no`

### 6. `commission_form_sections`

Blocchi logici dentro una pagina.

Campi:

- `id` uuid pk
- `version_id` uuid fk
- `page_id` uuid fk
- `key` text
- `title` text
- `description` text nullable
- `order_index` int
- `layout` json nullable
- `created_at` datetime

Vincoli:

- unique `version_id, key`

### 7. `commission_form_fields`

Campi compilabili.

Campi:

- `id` uuid pk
- `version_id` uuid fk
- `page_id` uuid fk
- `section_id` uuid nullable fk
- `key` text
- `label` text
- `placeholder` text nullable
- `help_text` text nullable
- `field_type` text: `TEXT`, `LONG_TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `CHECKBOX_GROUP`, `TABLE`, `DOCUMENT_CHECKLIST`, `SIGNATURE`
- `data_kind` text nullable: `STRING`, `INTEGER`, `DECIMAL`, `DATE`, `BOOLEAN`, `JSON`
- `is_required` boolean
- `is_searchable` boolean default false
- `is_summary_field` boolean default false
- `sensitivity` text: `NORMAL`, `CONFIDENTIAL`, `SECRET`
- `order_index` int
- `visibility_rule` json nullable
- `validation_rule` json nullable
- `default_value` json nullable
- `created_at` datetime

Vincoli:

- unique `version_id, key`
- index `version_id, page_id`
- index `version_id, section_id`

Nota:

I campi indicati come `is_summary_field` possono aggiornare colonne in `commission_records`, per esempio titolo, plant, target date o budget.

### 8. `commission_field_options`

Opzioni per select, multi-select e checkbox group.

Campi:

- `id` uuid pk
- `field_id` uuid fk
- `key` text
- `label` text
- `value` text
- `order_index` int
- `is_default` boolean
- `metadata` json nullable

Vincoli:

- unique `field_id, key`

### 9. `commission_table_definitions`

Definizione di una tabella dentro il form.

Campi:

- `id` uuid pk
- `field_id` uuid fk `commission_form_fields.id`
- `key` text
- `label` text
- `min_rows` int nullable
- `max_rows` int nullable
- `allow_add_rows` boolean default true
- `allow_remove_rows` boolean default true
- `is_catalog_backed` boolean default false
- `catalog_key` text nullable
- `created_at` datetime

### 10. `commission_table_columns`

Colonne di una tabella definita.

Campi:

- `id` uuid pk
- `table_definition_id` uuid fk
- `key` text
- `label` text
- `column_type` text: `TEXT`, `LONG_TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `SELECT`, `CHECKBOX`
- `is_required` boolean
- `order_index` int
- `width_hint` text nullable
- `validation_rule` json nullable
- `default_value` json nullable

Vincoli:

- unique `table_definition_id, key`

### 11. `commission_catalogs`

Cataloghi tabellari mantenuti da FG Automazioni, per esempio vendor list.

Campi:

- `id` uuid pk
- `workspace_id` uuid nullable fk
- `key` text
- `name` text
- `scope` text: `SYSTEM`, `WORKSPACE`
- `is_enabled` boolean
- `created_at` datetime
- `updated_at` datetime
- `deleted_at` datetime nullable

### 12. `commission_catalog_items`

Righe standard di catalogo, per esempio componenti e marche della vendor list.

Campi:

- `id` uuid pk
- `catalog_id` uuid fk
- `category` text nullable
- `item_key` text
- `label` text
- `reference_value` text nullable
- `metadata` json nullable
- `order_index` int
- `is_enabled` boolean

Vincoli:

- unique `catalog_id, item_key`

Nota:

La vendor list della sezione 9.4 non dovrebbe vivere come semplice testo nel template. Meglio catalogo: cosi FG puo aggiornare marche e componenti senza riscrivere il form.

### 13. `commission_checklists`

Istanza compilabile del form per una commessa.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `record_id` uuid fk `commission_records.id`
- `template_id` uuid fk
- `version_id` uuid fk
- `status` text: `DRAFT`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `SIGNED`, `LOCKED`, `ARCHIVED`
- `completion_percent` decimal nullable
- `current_page_no` int nullable
- `revision_no` int default 1
- `created_by_user_id` uuid nullable
- `updated_by_user_id` uuid nullable
- `created_at` datetime
- `updated_at` datetime
- `deleted_at` datetime nullable

Indici:

- index `workspace_id, record_id`
- index `workspace_id, status`
- index `workspace_id, updated_at`

### 14. `commission_field_values`

Valori semplici compilati.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `checklist_id` uuid fk
- `record_id` uuid fk
- `field_id` uuid fk
- `field_key` text
- `value_text` text nullable
- `value_number` decimal nullable
- `value_boolean` boolean nullable
- `value_date` date nullable
- `value_json` json nullable
- `display_value` text nullable
- `is_redacted_in_audit` boolean default false
- `updated_by_user_id` uuid nullable
- `created_at` datetime
- `updated_at` datetime

Vincoli:

- unique `checklist_id, field_id`
- index `workspace_id, record_id`
- index `workspace_id, field_key`

Nota:

Non basta un unico JSON: servono righe interrogabili per ricerca, filtri, audit puntuale e diff campo per campo.

### 15. `commission_table_rows`

Righe compilate di una tabella.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `checklist_id` uuid fk
- `record_id` uuid fk
- `table_definition_id` uuid fk
- `field_id` uuid fk
- `source_catalog_item_id` uuid nullable fk
- `row_index` int
- `is_deleted` boolean default false
- `created_by_user_id` uuid nullable
- `updated_by_user_id` uuid nullable
- `created_at` datetime
- `updated_at` datetime

### 16. `commission_table_cells`

Celle delle righe tabellari.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `row_id` uuid fk
- `column_id` uuid fk
- `column_key` text
- `value_text` text nullable
- `value_number` decimal nullable
- `value_boolean` boolean nullable
- `value_date` date nullable
- `value_json` json nullable
- `display_value` text nullable
- `updated_by_user_id` uuid nullable
- `created_at` datetime
- `updated_at` datetime

Vincoli:

- unique `row_id, column_id`

### 17. `commission_required_document_types`

Tipi documento richiesti dal template o da una sezione.

Campi:

- `id` uuid pk
- `version_id` uuid fk
- `key` text
- `label` text
- `section_key` text nullable
- `is_required` boolean
- `allow_multiple` boolean default true
- `order_index` int

Esempi iniziali:

- planimetria stabilimento
- layout area installazione
- fotografie area
- scheda tecnica prodotto/componente
- disegni tecnici 2D/3D
- campioni fisici
- specifiche qualita e tolleranze
- flow chart ciclo lavoro
- dati produttivi storici
- report analisi criticita
- video processo attuale
- schemi elettrici area
- documentazione macchine esistenti
- standard aziendali PLC/HMI/sicurezza
- normative specifiche
- policy cybersecurity
- schema rete OT
- registro modelli AI esistenti

### 18. `commission_attachments`

Collegamento tra commessa/checklist e documenti dell'archivio.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `record_id` uuid fk
- `checklist_id` uuid nullable fk
- `document_id` uuid fk `documents.id`
- `required_document_type_id` uuid nullable fk
- `field_id` uuid nullable fk
- `label` text nullable
- `uploaded_by_user_id` uuid nullable
- `created_at` datetime
- `deleted_at` datetime nullable

Vincoli:

- unique `record_id, document_id`

Nota:

Il file resta in `documents`. Questa tabella serve solo a dire: questo documento soddisfa questa voce della checklist.

### 19. `commission_record_access`

Permessi sul singolo record.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `record_id` uuid fk
- `user_id` uuid fk
- `role` text: `VIEWER`, `EDITOR`
- `granted_by_user_id` uuid nullable
- `created_at` datetime
- `updated_at` datetime
- `revoked_at` datetime nullable

Vincoli:

- unique `record_id, user_id`

Regola:

Admin e superadmin del workspace possono vedere e modificare tutto. Gli utenti standard vedono solo commesse create da loro o assegnate con `commission_record_access`, salvo policy diversa.

### 20. `commission_resource_locks`

Lock pessimistico per evitare modifiche concorrenti.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `record_id` uuid fk
- `resource_type` text: `RECORD`, `CHECKLIST`, `PAGE`
- `resource_id` uuid
- `locked_by_user_id` uuid fk
- `lock_token_hash` text
- `expires_at` datetime
- `last_heartbeat_at` datetime
- `created_at` datetime
- `released_at` datetime nullable

Vincoli:

- unique `workspace_id, resource_type, resource_id` dove `released_at is null`

Regola:

Ogni salvataggio deve verificare `lock_token` e `revision_no`. Se il lock e scaduto, l'utente deve riacquisirlo prima di scrivere.

### 21. `commission_events`

Backlog leggibile delle modifiche.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `record_id` uuid fk
- `checklist_id` uuid nullable fk
- `user_id` uuid nullable fk
- `event_type` text: `CREATED`, `UPDATED`, `FIELD_CHANGED`, `TABLE_ROW_ADDED`, `TABLE_ROW_UPDATED`, `TABLE_ROW_REMOVED`, `ATTACHMENT_ADDED`, `ATTACHMENT_REMOVED`, `LOCK_ACQUIRED`, `LOCK_RELEASED`, `SIGNED`, `STATUS_CHANGED`, `IMPORT_APPLIED`
- `page_key` text nullable
- `section_key` text nullable
- `field_key` text nullable
- `table_key` text nullable
- `old_display_value` text nullable
- `new_display_value` text nullable
- `payload` json nullable
- `is_sensitive` boolean default false
- `created_at` datetime

Indici:

- index `workspace_id, record_id, created_at`
- index `workspace_id, user_id, created_at`

Nota:

Per campi `CONFIDENTIAL` o `SECRET` non si salvano valori completi, solo descrizioni redatte.

### 22. `commission_signatures`

Presa visione finale.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `record_id` uuid fk
- `checklist_id` uuid fk
- `template_version_id` uuid fk
- `signed_revision_no` int
- `signed_by_user_id` uuid fk
- `signed_by_display_name` text
- `signed_by_email` text nullable
- `signature_label` text nullable
- `signed_at` datetime
- `signature_payload` json nullable
- `revoked_at` datetime nullable
- `revoked_by_user_id` uuid nullable
- `revoke_reason` text nullable

Nota:

Non e una firma legale. E una presa visione tracciata dell'utente autenticato.

### 23. `commission_import_sources`

Sorgenti esterne future.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `name` text
- `provider_key` text
- `base_url` text nullable
- `is_enabled` boolean
- `configuration` json nullable
- `created_by_user_id` uuid nullable
- `created_at` datetime
- `updated_at` datetime
- `deleted_at` datetime nullable

Nota:

Niente segreti in chiaro. Segreti in secret store/env o tabella dedicata cifrata se servira.

### 24. `commission_import_mappings`

Mapping tra campi esterni e campi Birgus.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `source_id` uuid fk
- `template_version_id` uuid fk
- `external_field_key` text
- `target_kind` text: `RECORD_FIELD`, `FORM_FIELD`, `TABLE_COLUMN`, `ATTACHMENT`
- `target_key` text
- `transform_rule` json nullable
- `is_required` boolean
- `created_at` datetime
- `updated_at` datetime

### 25. `commission_import_runs`

Esecuzioni import.

Campi:

- `id` uuid pk
- `workspace_id` uuid fk
- `source_id` uuid fk
- `requested_by_user_id` uuid nullable
- `status` text: `PENDING`, `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED`
- `started_at` datetime nullable
- `finished_at` datetime nullable
- `records_created` int default 0
- `records_updated` int default 0
- `records_skipped` int default 0
- `error_message` text nullable
- `payload_summary` json nullable
- `created_at` datetime

### 26. `commission_import_run_items`

Dettaglio import per ogni elemento esterno.

Campi:

- `id` uuid pk
- `run_id` uuid fk
- `workspace_id` uuid fk
- `external_reference` text
- `record_id` uuid nullable fk
- `status` text: `CREATED`, `UPDATED`, `SKIPPED`, `FAILED`
- `message` text nullable
- `raw_payload_hash` text nullable
- `created_at` datetime

## Quali dati del documento diventano colonne forti

### In `commission_records`

Da `Informazioni generali progetto`:

- Nr. Commessa -> `code`
- Cliente -> `company_id` o `client_id`, piu label libera se non anagrafato
- Descrizione progetto -> `title`/`description`
- Tecnico / Produzione cliente -> `customer_technical_contact` oppure `commission_record_contacts`
- Data sopralluogo -> `survey_date`
- Stabilimento / Plant -> `plant_name`
- Reparto / Linea produttiva -> `department_or_line`
- Referente FG Automazioni -> `fg_reference_user_id` o `fg_reference_name`

Da `Tempi e budget`, solo per ricerca e lista:

- Data target installazione -> `target_installation_date`
- Data avvio produzione -> `target_production_start_date`
- Budget disponibile -> `budget_band`
- Investimento approvato -> `investment_state`

Da stato operativo:

- avanzamento -> `status`, `current_checklist_id`, `revision_no`
- proprietario -> `owner_user_id`

### Nei valori dinamici

Tutto il resto:

- processo produttivo attuale
- prodotto/componente
- obiettivi automazione
- spazio/layout
- utilities
- controllo/supervisione/IT
- visione e AI
- robotica
- sicurezza e normative
- manutenzione/assistenza
- collaudo/validazione
- allegati richiesti
- note
- cybersecurity OT/NIS2

Questi campi restano in `commission_field_values`, `commission_table_rows` e `commission_table_cells`, ma alcuni possono avere `is_searchable=true`.

## Campi sensibili

Campi NIS2/OT da trattare almeno come `CONFIDENTIAL`:

- schema rete OT
- VLAN/subnet
- regole firewall
- standard interni
- identity provider
- password policy
- accesso remoto
- account di servizio
- vault/consegna credenziali
- vulnerability scan
- backup/RTO/RPO
- procedure incidenti
- risk assessment

Regole:

- non salvare vecchio/nuovo valore completo negli eventi;
- audit globale con payload redatto;
- visibilita solo a editor autorizzati e admin;
- valutare cifratura applicativa per alcuni campi prima di andare in produzione reale.

## Allegati e knowledge AI

Gli allegati non devono vivere in una tabella separata di file. Devono usare `documents`.

La relazione consigliata:

- `documents.domain_entity_type = "COMMISSION_RECORD"`
- `documents.domain_entity_id = commission_records.id`
- `commission_attachments.document_id = documents.id`

Knowledge:

- se un allegato viene indicizzato, usare `knowledge_documents.source_entity_type = "COMMISSION_ATTACHMENT"` oppure `"COMMISSION_RECORD"`;
- se una commessa viene eliminata, archiviata con cancellazione o un allegato viene rimosso, bisogna eliminare o soft-delete anche la knowledge collegata;
- per campi NIS2/OT, indicizzazione AI disabilitata di default salvo autorizzazione esplicita.

## Stati consigliati

### `commission_records.status`

- `DRAFT`: commessa creata ma non lavorata.
- `IN_PROGRESS`: checklist in compilazione.
- `READY_FOR_REVIEW`: dati completi, serve controllo.
- `SIGNED`: presa visione completata.
- `ARCHIVED`: non modificabile, resta consultabile.
- `CANCELLED`: annullata.

### `commission_checklists.status`

- `DRAFT`
- `IN_PROGRESS`
- `READY_FOR_REVIEW`
- `SIGNED`
- `LOCKED`
- `ARCHIVED`

## Permessi

Livelli sul modulo:

- workspace disabilitato: nessun riferimento visibile.
- workspace abilitato: modulo visibile secondo ruolo utente.
- admin/superadmin: configurazione template, cataloghi, mapping import, accessi record.
- editor: compila record assegnati.
- viewer: consulta record assegnati.

Livelli sul record:

- `VIEWER`: legge dati non riservati autorizzati e allegati consentiti.
- `EDITOR`: modifica se acquisisce lock.

Da decidere:

- se tutti gli utenti del workspace vedono tutte le commesse in sola lettura;
- oppure se la visibilita e solo per assegnazione esplicita.

Consiglio MVP:

- admin/superadmin vedono tutto;
- creator e utenti assegnati vedono la commessa;
- editor assegnati modificano;
- viewer assegnati leggono.

## Concorrenza

Regola minima:

- apertura in modifica: crea lock su `CHECKLIST`;
- heartbeat ogni 20-30 secondi;
- scadenza lock 2-5 minuti se browser chiuso;
- salvataggio: richiede lock valido e `revision_no` corretto;
- conflitto: bloccare salvataggio e chiedere refresh/confronto, senza sovrascrivere.

In futuro:

- lock per singola pagina se vogliamo permettere a piu utenti di compilare sezioni diverse.

## Audit/backlog

Ogni azione significativa produce:

- evento leggibile in `commission_events`;
- audit sintetico in `audit_logs`.

Eventi obbligatori:

- creazione commessa;
- cambio stato;
- modifica campo;
- aggiunta/rimozione riga tabella;
- aggiunta/rimozione allegato;
- acquisizione/rilascio/scadenza lock;
- firma;
- import applicato;
- errore import;
- eliminazione/archiviazione.

## MVP database consigliato

Per partire senza sovraingegnerizzare:

1. `commission_records`
2. `commission_record_contacts`
3. `commission_form_templates`
4. `commission_form_versions`
5. `commission_form_pages`
6. `commission_form_sections`
7. `commission_form_fields`
8. `commission_field_options`
9. `commission_table_definitions`
10. `commission_table_columns`
11. `commission_catalogs`
12. `commission_catalog_items`
13. `commission_checklists`
14. `commission_field_values`
15. `commission_table_rows`
16. `commission_table_cells`
17. `commission_required_document_types`
18. `commission_attachments`
19. `commission_record_access`
20. `commission_resource_locks`
21. `commission_events`
22. `commission_signatures`

Da rimandare finche non abbiamo API/campi della piattaforma esterna:

23. `commission_import_sources`
24. `commission_import_mappings`
25. `commission_import_runs`
26. `commission_import_run_items`

## Decisione importante

La struttura piu robusta e:

- anagrafica commessa snella e ricercabile;
- form dinamico versionato;
- valori normalizzati per campo, non JSON unico;
- tabelle dinamiche con righe/celle;
- documenti nell'archivio esistente;
- lock e revision number per concorrenza;
- backlog dedicato piu audit globale;
- NIS2/OT trattato come dato riservato.

Questa struttura permette di aggiungere nuove sezioni o nuovi form senza migrare il database ogni volta.
