# Security Policy

## Baseline

Birgus applica le linee guida di sviluppo sicuro del 15/04/2026:

- Pull Request obbligatoria.
- Review indipendente.
- Test ed evidenze prima del merge.
- Nessun segreto nel codice.
- Validazione input.
- Error handling senza leak.
- Logging sicuro.
- Dipendenze monitorate.
- Eccezioni documentate.

## Segnalazioni

Per vulnerabilita o deviazioni di sicurezza, aprire una issue privata/canale interno oppure preparare una PR con:

- descrizione del problema;
- rischio;
- impatto dati/infrastruttura;
- fix proposto;
- test eseguiti.

## Eccezioni

Usare `docs/SECURITY_EXCEPTION_TEMPLATE.md`.

Ogni eccezione deve avere:

- requisito non rispettato;
- motivazione;
- rischio associato;
- controlli compensativi;
- responsabile accettazione rischio;
- scadenza o data revisione.
