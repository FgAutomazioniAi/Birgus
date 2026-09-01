---
key: offer_priority
ui: Priorita offerte
---
# offer_priority

Cruscotto operativo che ordina e rende lavorabili le offerte commerciali per priorita.

## Backend: blocchi funzionali

- Lettura e aggiornamento dati operativi delle offerte.
- Calcolo/assegnazione della fascia di priorita commerciale.
- API `operations` per priorita offerte.

## Dati posseduti

- `CommercialOffer`, `CommercialOfferLine`.
- Enum `CommercialOfferPriorityBand`.

## Frontend: blocchi visibili

- Sidebar e pagina **Priorita offerte**.
- Tabella operativa configurabile, filtri, ordinamenti e controlli sull'offerta.

## Confini condivisi

- Non coincide con preventivo/versione progetto di [[project_management]]: usa un modello operativo separato.
- Non genera workflow autonomamente; potra essere un'origine o un bersaglio di automazioni future.
- Fa parte del gruppo di attivazione atomico **Pianificazione operativa** con [[maintenance_proposals]] e [[maintenance_calendar]]: nel workspace i tre moduli si attivano e disattivano insieme.

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
