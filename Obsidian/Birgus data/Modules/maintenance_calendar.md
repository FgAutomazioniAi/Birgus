---
key: maintenance_calendar
ui: Calendario manutenzioni
---
# maintenance_calendar

Pianificazione temporale delle manutenzioni e gestione dello stato delle attivita pianificate.

## Backend: blocchi funzionali

- Lettura, creazione e aggiornamento delle voci di piano manutenzione.
- Gestione stati della pianificazione e dati temporali/operativi.
- API `operations` per calendario manutenzioni.

## Dati posseduti

- `MaintenancePlanEntry`.
- Enum `MaintenancePlanEntryStatus`.

## Frontend: blocchi visibili

- Sidebar e pagina **Calendario manutenzioni**.
- Tabella/calendario operativo configurabile, filtri e controlli sulle attivita pianificate.

## Confini condivisi

- Non produce proposte: queste sono [[maintenance_proposals]].
- Eventi storici e assegnazioni operative appartengono a [[customer_map]].
- Fa parte del gruppo di attivazione atomico **Pianificazione operativa** con [[offer_priority]] e [[maintenance_proposals]].

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
