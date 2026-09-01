---
key: project_management
ui: Progetti e Clienti
---
# project_management

Anagrafica commerciale e gestione del progetto/preventivo.

## Backend: blocchi funzionali

- CRUD di **aziende**, **clienti**, **progetti** e controllo workspace.
- Gestione di **autori**, **revisioni**, **versioni** e versione predefinita di un progetto.
- Collegamenti progetto-cliente e dati commerciali del progetto.
- Orchestrazione del preventivo: dati estratti, job, costruzione DOCX e consegna email.
- API: `projects`, `project-crud`, `project-assets` (i file usano l'Archivio).

## Dati posseduti

- `Company`, `Client`, `Project`, `ProjectClient`.
- `ProjectAuthor`, `ProjectRevision`, `ProjectVersion`, `ProjectStatus`.
- `QuotationOrchestratorJob` e dati strutturati del preventivo.

## Frontend: blocchi visibili

- Sidebar **Progetti**: elenco, creazione, modifica e dettaglio.
- Sidebar **Clienti**: elenco, creazione e modifica.
- Editor progetto: dati generali, clienti associati, autori, revisioni/versioni e file.
- Scorciatoie **Progetti** e **Clienti** nella dashboard workspace.

## Confini condivisi

- I file fisici sono di [[document_archive]].
- Il prompt e gli strumenti preventivo gia presenti nel catalogo Workflow sono da riallocare o dismettere prima di rimuoverli: non sono una dipendenza di Progetti.
- L'anagrafica operativa geolocalizzata e di [[customer_map]].

## Dipendenze attuali

Nessuna.

## Moduli dipendenti

Nessuno.

## Revisione

- [ ] Mantieni
- [ ] Rinomina
- [ ] Dividi
- [ ] Rimuovi dalla navigazione

**Dipendenze desiderate:**

**Note:**
