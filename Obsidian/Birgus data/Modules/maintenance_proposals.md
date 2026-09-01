---
key: maintenance_proposals
ui: Proposte manutenzione
---
# maintenance_proposals

Gestione delle proposte di manutenzione da valutare, approvare o trasformare in pianificazione.

## Backend: blocchi funzionali

- Lettura e aggiornamento delle proposte operative.
- Classificazione dell'urgenza e dati economici/operativi della proposta.
- API `operations` per proposte manutenzione.

## Dati posseduti

- `MaintenanceProposal`.
- Enum `MaintenanceProposalUrgency`.

## Frontend: blocchi visibili

- Sidebar e pagina **Proposte manutenzione**.
- Tabella operativa configurabile, filtri e azioni sulle proposte.

## Confini condivisi

- Non possiede appuntamenti/piano: questi sono [[maintenance_calendar]].
- Puo riferirsi a clienti/riferimenti operativi di [[customer_map]], senza esserne proprietario.
- Fa parte del gruppo di attivazione atomico **Pianificazione operativa** con [[offer_priority]] e [[maintenance_calendar]].

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
