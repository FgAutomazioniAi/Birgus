---
key: audit_center
ui: Audit
---
# audit_center

Tracciamento consultabile delle operazioni rilevanti effettuate nell'istanza.

## Backend: blocchi funzionali

- Scrittura eventi audit con attore, workspace, modulo, azione, entita e metadati.
- Lettura filtrata e paginata del registro.
- API `audit`.

## Dati posseduti

- `AuditLog`.

## Frontend: blocchi visibili

- Consultazione audit nelle aree amministrative che la espongono; non ha una voce sidebar autonoma.

## Confini condivisi

- Ogni servizio puo inviare un evento audit, ma non trasferisce qui la proprieta dei propri dati di dominio.
- La dipendenza dichiarata da [[notification_center]] e da riesaminare: un audit log non richiede semanticamente una notifica.

## Dipendenze attuali

- [[notification_center]]

## Moduli dipendenti

Nessuno.

## Revisione

- [ ] Mantieni
- [ ] Rendi indipendente dalle notifiche
- [ ] Altro

**Dipendenze desiderate:**

**Note:**
