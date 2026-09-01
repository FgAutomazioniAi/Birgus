---
key: customer_map
ui: Mappa clienti
---
# customer_map

Vista operativa geografica dei clienti, dei riferimenti di lavoro e degli eventi di assistenza.

## Backend: blocchi funzionali

- Gestione clienti operativi, indirizzi e stato di geocodifica.
- Gestione riferimenti/commesse operativi, eventi di servizio e assegnazioni.
- Calcolo/lettura insight operativi per la mappa.
- API `operations` per mappa clienti.

## Dati posseduti

- `OperationalCustomer`, `CustomerAddress`, `OperationalWorkReference`.
- `ServiceEvent`, `ServiceEventAssignment`.

## Frontend: blocchi visibili

- Sidebar e pagina **Mappa clienti**.
- Mappa geolocalizzata, tabella/configurazione dati operativi, filtri e dettagli di clienti/riferimenti/eventi.

## Confini condivisi

- Non e l'anagrafica commerciale di [[project_management]]: oggi e un modello operativo parallelo, da valutare per unificazione.
- Proposte e calendario manutenzioni leggono informazioni operative ma possiedono i loro dati.

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
