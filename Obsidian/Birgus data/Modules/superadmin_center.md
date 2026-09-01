---
key: superadmin_center
ui: Superadmin
---
# superadmin_center

Console di amministrazione globale dell'istanza, visibile solo ai superuser: workspace, utenti, ruoli, moduli e stato d'installazione.

## Backend: blocchi funzionali

- Creazione/modifica workspaces e assegnazioni modulo.
- Creazione/modifica utenti, membership, ruoli e spostamento utente tra workspaces.
- Override modulo per utente rispetto al workspace.
- Lettura catalogo moduli e stato operativo richiesto dalla console.
- Consultazione delle informazioni di inizializzazione/profilo installazione quando esposte dal servizio.
- API `superadmin` e `module-management` per azioni globali.

## Dati amministrati

- Amministra, ma non possiede, `Organization`, `Workspace`, `User`, `WorkspaceMembership`, `UserWorkspaceRole`, `WorkspaceModule`, `UserModuleOverride`.
- Il profilo installazione e `InstallationProfileSnapshot`.

## Frontend: blocchi visibili

- Prima voce sidebar **Superadmin**, solo per superuser abilitati.
- Pannello Superadmin: utenti, workspaces, ruoli e moduli consentiti.
- Impostazioni Admin workspace: toggle modulo e controlli amministrativi disponibili.

## Confini condivisi

- E una console trasversale: non possiede i dati funzionali dei moduli.
- Identita, sessioni, password e 2FA sono infrastruttura Identity condivisa e non un modulo catalogato.
- Il bootstrap catalogo non crea da solo utenti/workspace; l'inizializzazione della prima istanza li crea esplicitamente.

## Dipendenze attuali

Nessuna dichiarata.

## Moduli dipendenti

Nessuno.

## Revisione

- [ ] Mantieni come obbligatorio
- [ ] Altro

**Dipendenze desiderate:**

**Note:**
