---
key: document_archive
ui: Archivio
---
# document_archive

Archivio documentale comune al workspace: file, metadati, stato, cartelle logiche e storage oggetti.

## Backend: blocchi funzionali

- Upload, download, anteprima, aggiornamento metadati e cancellazione dei documenti.
- Gestione cartelle/nodi archivio, tipi file e stati file.
- Collegamento dei file ai progetti e rimozione coordinata della knowledge quando un documento e eliminato.
- Integrazione Garage/S3 per lo storage binario.
- API `document-archive` e `project-assets`.

## Dati posseduti

- `Document`, `Node`, `FileType`, `FileStatus`.

## Frontend: blocchi visibili

- Sidebar e pagina **Archivio**.
- Cartelle, caricamento, ricerca/filtri, selezione, visualizzazione e cancellazione file.
- Sezione file nel dettaglio progetto, se [[project_management]] e attivo.

## Confini condivisi

- Garage/S3 e database sono infrastruttura condivisa, non una funzione della pagina Archivio.
- L'indicizzazione semantica e la ricerca AI sono di [[document_intelligence]].
- DDT, Measure Report, chatbot e workflow possono riferirsi a un file, ma l'Archivio ne resta proprietario.

## Dipendenze attuali

Nessuna.

## Moduli dipendenti

- [[document_intelligence]]

## Revisione

- [ ] Mantieni come base
- [ ] Dividi
- [ ] Altro

**Dipendenze desiderate:**

**Note:**
