# Birgus - Stile di coding sicuro

## Naming e struttura

- Mantenere la separazione tra `core`, `modules`, `nest`, `shared`, `storage` e `worker`.
- Usare nomi espliciti per DTO, command, service e repository.
- Evitare logica di dominio nei controller: i controller validano input, autorizzazioni e delegano ai servizi.

## Validazione input

- Validare body, params e query con Zod o controlli equivalenti.
- Limitare stringhe, array e payload JSON con lunghezze, enum e whitelist quando possibile.
- Evitare `z.unknown()` per payload persistiti o riesposti, salvo eccezione documentata.

## Error handling

- Usare `AppError` per errori applicativi attesi.
- Non restituire stack trace, payload interni, prompt, token o dettagli infrastrutturali al client.
- I servizi Python devono loggare l'errore internamente e rispondere con messaggi generici sui 500.

## Logging sicuro

- Non loggare password, token, codici reset, segreti TOTP, prompt completi, documenti caricati o risposte LM raw.
- Preferire metriche redatte: durata, stato, dimensione, id job/sessione, correlation id.

## Dipendenze

- Ogni nuova libreria deve avere una motivazione tecnica.
- `npm audit --omit=dev` backend e frontend deve restare pulito da high/critical non documentate.
- Le vulnerabilita accettate temporaneamente richiedono eccezione sicurezza.

## Sessioni, cookie e segreti

- Cookie sessione sempre `HttpOnly`; `Secure=true` richiesto in produzione HTTPS.
- `AUTH_PEPPER` e `AUTH_TOTP_ENCRYPTION_KEY` sono obbligatori in produzione.
- Seed e utenti demo non devono usare password hardcoded.

## Test

- Aggiungere test per auth, autorizzazioni, validazione input, upload file e servizi critici quando si modifica uno di questi ambiti.
- Ogni PR deve riportare i comandi eseguiti e l'esito.
