# Contribuire a Birgus

Le modifiche a Birgus seguono le linee guida di sviluppo sicuro del 15/04/2026.

## Regole Pull Request

- Ogni modifica deve passare da Pull Request.
- La PR deve usare `.github/PULL_REQUEST_TEMPLATE.md`.
- La PR deve includere descrizione, motivazione, riferimento requisito/ticket, test eseguiti e impatti.
- L'autore non deve approvare da solo la propria PR.
- Le osservazioni di sicurezza vanno risolte prima del merge oppure tracciate con eccezione approvata.

## Controlli locali obbligatori

Prima di aprire una PR eseguire:

```bash
npm run security:check
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
```

## Segreti e configurazioni

- Non committare `.env`, `garage/garage.local.toml`, token, password o chiavi reali.
- Usare file `.example` o documentazione per i template.
- `BIRGUS_SEED_PASSWORD` deve essere fornita da ambiente e non hardcoded.
- I profili produzione devono avere cookie secure e segreti obbligatori.

## Dipendenze

- Prima di aggiungere una libreria, controllare `docs/APPROVED_LIBRARIES.md`.
- Ogni nuova dipendenza deve essere motivata nella PR.
- Vulnerabilita high/critical non sono accettabili senza eccezione formale.
