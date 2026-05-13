# Backend Coverage Audit

## Aree operative coperte dal backend

### Identita e accesso
- autenticazione
- sessioni
- reset password
- moduli per workspace
- override moduli per utente
- preferenze utente

### Archivio e documenti
- upload documenti progetto
- recupero file da Garage
- file per versione progetto
- DDT documenti
- knowledge documentale
- semantic search
- catalogo route API esposte

### Audit
- endpoint di consultazione audit
- registrazione audit su:
  - companies
  - clients
  - project authors
  - project revisions
  - projects
  - project versions

### Progetti
- CRUD progetto
- gestione versioni
- selezione versione di default
- collegamento cliente principale
- preventivo PDF
- generazione preventivo DOCX
- invio mail preventivo

### Agenti di modulo
- elenco agenti
- aggiornamento prompt attivo
- reset prompt attivo a prompt originale

### Workflow
- elenco tools
- elenco workflow
- dettaglio workflow con nodi ed edge
- creazione workflow
- aggiornamento workflow
- elenco run workflow
- creazione run workflow
- dettaglio run workflow
- dispatch automatico run su queue interna
- executor backend con tracciamento step e stati run

### Spedizioni
- elenco spedizioni
- dettaglio spedizione
- creazione spedizione
- aggiornamento specifica tecnica
- aggiornamento articoli spedizione
- registrazione eventi spedizione

### DDT
- upload
- coda analisi
- OCR
- inferenza
- salvataggio analisi strutturata
- indicizzazione knowledge a fine analisi

### Assistente
- sessioni
- messaggi
- tool call
- memoria
- contesto documentale

### Notifiche
- listing
- mark as read
- clear
- creazione manuale
- creazione automatica su eventi chiave di progetto, spedizione, DDT, preventivi

## Tabelle di supporto interne
Queste tabelle sono backend-managed o infrastrutturali e non richiedono necessariamente una UI o un modulo CRUD dedicato:
- roles
- permissions
- role_permissions
- user_workspace_roles
- auth_sessions
- password_reset_codes
- file_types
- file_statuses
- module_dependencies

## Stato attuale
Il backend copre ora le funzioni operative principali del software.
I gap residui sono concentrati soprattutto su:
- copertura audit ancora non uniforme su tutti i domini
- viewer frontend dedicati ancora mancanti per alcuni moduli backend
