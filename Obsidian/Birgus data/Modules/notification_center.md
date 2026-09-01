---
key: notification_center
ui: Notifiche
---
# notification_center

Centro notifiche persistenti del workspace e configurazione della consegna email applicativa.

## Backend: blocchi funzionali

- Creazione, elenco, lettura e chiusura di notifiche persistenti per utente/workspace/modulo.
- Provider SMTP: lettura, salvataggio e verifica configurazione email.
- Invio email operative quando chiamato da workflow o altri servizi.
- API `notifications` e `settings/mail-provider-settings`.

## Dati posseduti

- `Notification`.
- Configurazione mail in `AppSetting` e stati `MailDeliveryStatus` quando usati dai flussi.

## Frontend: blocchi visibili

- Indicatore notifiche nell'header e pannello relativo.
- Segnalazioni nell'area privata/dashboard, incluse revisioni provenienti dai workflow.
- Blocco **Provider email** nelle Impostazioni Admin.

## Confini condivisi

- Il workflow decide quando serve una revisione e conserva la decisione in [[workflow_management]].
- SMTP e infrastruttura di consegna; qui non vive il template o la logica di ogni email.
- Le notifiche possono essere attribuite a qualsiasi modulo con `moduleKey`.

## Dipendenze attuali

Nessuna.

## Moduli dipendenti

- [[audit_center]]

## Revisione

- [ ] Mantieni come base
- [ ] Rendi Audit indipendente
- [ ] Altro

**Dipendenze desiderate:**

**Note:**
