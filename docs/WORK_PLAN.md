# Work plan applied

1. Analisi del codice DEMO e mapping domini.
2. Inizializzazione nuovo progetto in `~/Progetti/Birgus`.
3. Definizione schema Prisma multi-tenant modulare.
4. Implementazione servizi OOP core + moduli principali.
5. Introduzione storage provider abstraction e worker layer.
6. Documentazione di analisi e mappa migrazione.

## Prossima iterazione consigliata
- integrazione pipeline DDT reale (OCR + AI) al posto dello stub
- endpoint multipart upload/download file per parity con flussi documentali reali
- test unitari/integration per guard moduli/permessi e servizi dominio
- adapter worker persistente (es. queue esterna) oltre all'attuale in-memory

## Iterazione applicata (oggi)
- aggiunto layer OOP di autorizzazione per ruoli/permessi (`PermissionPolicy`)
- integrato `PermissionGuard` su controller principali
- aggiunte API per override modulo per utente (`allow`/`deny`/`clear`)
- esteso `module-management` con verifica dipendenze modulo (enable/disable safety)
- compatibilità backend per frontend storico: auth cookie `vl_session` + fallback workspace automatico
- aggiunti moduli OOP `clients` e `user-preferences` con endpoint legacy-compatible
- estesi endpoint progetti/versioni e notifiche per shape/route compatibili con UI precedente
