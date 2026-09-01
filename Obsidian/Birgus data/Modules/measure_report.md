---
key: measure_report
ui: Measure Report
---
# measure_report

Analisi di report dimensionali/di misura, con classificazione del formato e persistenza delle righe fuori tolleranza.

## Backend: blocchi funzionali

- Caricamento del report e scelta/rilevamento del tipo documento.
- Avvio e monitoraggio dell'analisi tramite workflow `measure_report_pipeline`.
- Analizzatori per Zeiss 1, Zeiss 2, Vicivision e DEA.
- Interpretazione AI del report e salvataggio di esito, misure e anomalie.
- API `measure-report`.

## Dati posseduti

- `MeasureReportDocument`, `MeasureReportAnalysisResult`, `MeasureReportAnalysisRow`.

## Frontend: blocchi visibili

- Sidebar e pagina **Measure Report**.
- Caricamento, selezione tipo, stato analisi, risultato e tabella delle righe rilevate.
- Workflow, agenti e strumenti della scheda Measure Report.

## Confini condivisi

- Il file persiste in [[document_archive]] quando viene archiviato.
- Gli agenti formato sono di [[agent_management]]; il motore di run e [[workflow_management]].
- Non e un modulo OCR generico: interpreta report di misura e il proprio schema dati.

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
