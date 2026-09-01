---
key: ddt_processing
ui: DDT Reader
---
# ddt_processing

Elaborazione dei documenti di trasporto: acquisizione, OCR, estrazione strutturata e storico della lettura.

## Backend: blocchi funzionali

- Invio e validazione del documento DDT.
- Avvio, monitoraggio e storico di job, stati, eventi ed errori di lettura.
- Chiamata al motore OCR esterno e all'analizzatore DDT; normalizzazione di intestazione, articoli e metadati.
- Workflow standard `ddt_processing` e agente/prompt DDT preconfigurato.
- Lifecycle OCR: il toggle puo avviare o fermare il container OCR tramite il servizio dedicato.
- API `ddt-reader` e runtime OCR del module-management.

## Dati posseduti

- `DdtDocument`, `DdtAnalysisResult`, `DdtArticleItem`.
- `DdtProcessingJob`, `DdtProcessingEvent`.

## Frontend: blocchi visibili

- Sidebar e pagina **DDT Reader**.
- Caricamento, stato di elaborazione, risultato strutturato e righe estratte.
- Toggle OCR nelle impostazioni Admin, con stato del runtime.
- Workflow/nodi/agenti DDT nella relativa scheda Workflow.

## Confini condivisi

- Il container OCR e un servizio Docker separato, non codice incorporato nel processo Node.
- Il file sorgente puo essere in [[document_archive]], ma la semantica e il risultato DDT restano qui.
- La pipeline usa [[workflow_management]], mentre DDT Reader e un ingresso applicativo dedicato.

## Dipendenze attuali

Nessuna dichiarata.

## Moduli dipendenti

Nessuno.

## Revisione

- [ ] Mantieni
- [ ] Rendi opzionale
- [ ] Rimuovi

**Dipendenze desiderate:**

**Note:**
