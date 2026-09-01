---
key: document_intelligence
ui: Knowledge
---
# document_intelligence

Knowledge base del workspace costruita sui documenti dell'Archivio: indicizzazione, embedding, ricerca semantica e analisi di insiemi documentali.

## Backend: blocchi funzionali

- Creazione/aggiornamento della knowledge di un documento e rimozione quando il documento viene eliminato.
- Estrazione testo, chunking, embedding tramite `python_modules` e ricerca per similarita.
- Analisi di un set documentale e restituzione di fonti/estratti.
- Strumenti workflow: `refresh_document_knowledge`, `search_workspace_knowledge`, `analyze_document_set`.
- API `knowledge`.

## Dati posseduti

- `KnowledgeDocument`, `KnowledgeChunk` e stati di indicizzazione/embedding.

## Frontend: blocchi visibili

- Stato e azioni knowledge associati ai documenti nell'**Archivio**.
- Strumenti di ricerca e analisi documentale nell'editor **Workflow**.
- Nessuna sidebar/pagina autonoma: la UI vive nei moduli che usano la capability.

## Confini condivisi

- Richiede [[document_archive]] per i documenti sorgente, ma non possiede il file.
- Puo alimentare [[conversational_assistant]] e [[workflow_management]], ma non e una chat.
- Il servizio Python e un adattatore tecnico condiviso, non una vista frontend.

## Dipendenze attuali

- [[document_archive]]

## Moduli dipendenti

- [[conversational_assistant]]
- [[workflow_management]]

## Revisione

- [ ] Mantieni
- [ ] Rendi capability opzionale dei workflow
- [ ] Dividi

**Dipendenze desiderate:**

**Note:**
