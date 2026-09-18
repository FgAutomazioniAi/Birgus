---
name: copilota
description: Describe what this custom agent does and when to use it.
argument-hint: The inputs this agent expects, e.g., "a task to implement" or "a question to answer".
# tools: ['vscode', 'execute', 'read', 'agent', 'edit', 'search', 'web', 'todo'] # specify the tools this agent can use. If not set, all enabled tools are allowed.
---

# Istruzioni per GitHub Copilot - Birgus

## Mandato

Birgus e' una piattaforma web modulare e multi-workspace per la gestione operativa di aziende, clienti, commesse, checklist, documenti, workflow e funzionalita' AI.

Contribuisci allo sviluppo del prodotto, al debug e all'analisi tecnica con modifiche piccole, motivate e verificabili. Dai priorita' a correttezza, isolamento dei dati, autorizzazioni, sicurezza e coerenza con le convenzioni gia' presenti nel repository.

Non trattare una descrizione, un commento o un documento di handover come fonte di verita' definitiva. Prima di modificare il codice, verifica lo stato attuale nei file interessati, nello schema Prisma, nelle API, nei test e nelle configurazioni versionate.

## Mappa del repository

- `src/`: backend TypeScript, NestJS e Fastify; moduli di dominio, servizi, autorizzazioni e controller HTTP.
- `frontend/`: Next.js, React, TypeScript e Tailwind CSS; pagine, componenti, client API e stato dell'interfaccia.
- `prisma/schema.prisma`: modello dati PostgreSQL e relazioni.
- `scripts/`: setup, bootstrap del catalogo applicativo, controlli operativi e smoke test.
- `tests/`: test backend e di integrazione leggera.
- `docs/`: requisiti, convenzioni e policy tecniche.
- `docker-compose*.yml`, `Dockerfile*`: esecuzione dei servizi in Docker Compose.

Il backend usa PostgreSQL con Prisma. Lo storage e' Garage, compatibile S3. OCR e componenti Python sono servizi separati. I provider AI adottano contratti OpenAI-compatible o integrazioni esterne dedicate.

## Fonte di verita' e approccio al lavoro

1. Parti dal requisito e individua il flusso completo coinvolto: interfaccia, client API, controller, guard, servizio, Prisma o servizio esterno.
2. Cerca codice e test correlati con `rg`; riusa i pattern locali prima di introdurre un'astrazione nuova.
3. Verifica i contratti effettivi e gli errori gia' gestiti prima di cambiarli. Non correggere un sintomo frontend quando la causa e' nel backend, nell'autorizzazione o nell'integrazione esterna.
4. Mantieni una modifica concentrata sul problema. Non eliminare, riformattare estesamente o rifattorizzare codice estraneo alla richiesta.
5. Per un difetto riproducibile, aggiungi o aggiorna un test di regressione quando il rischio e la superficie di modifica lo giustificano.
6. Distingui sempre tra comportamento verificato, deduzione tecnica e parti non testate.

## Multi-workspace, moduli e autorizzazioni

Birgus e' multi-tenant. Organizzazione, workspace, membership, ruoli, moduli e dati di dominio sono separati: ogni lettura e scrittura deve essere limitata al workspace risolto per l'utente autenticato.

- Non accettare dal client un workspace, un ruolo o un'identita' come fonte affidabile. Usa il `RequestContext` e i servizi di tenancy/autorizzazione esistenti.
- Le autorizzazioni backend usano `PermissionKey`, `PermissionPolicy`, `@RequirePermission`, `ModuleKey`, `ModuleAccessPolicy` e `@RequireModule`. Estendi questi meccanismi invece di crearne di paralleli.
- Un modulo attivo nel frontend non autorizza una chiamata API. Se una funzione dipende da un modulo, proteggi il controller e, se necessario, il servizio.
- I ruoli di sistema seedati sono `developer`, `superuser`, `admin` e `operator`. Ruoli e permessi sono dati del catalogo: non dedurre l'autorizzazione da una gerarchia implicita o solo dalla UI.
- Le eccezioni specifiche del ruolo `developer` devono restare esplicite, limitate alle operazioni di installazione o amministrazione previste e protette anche lato backend.
- Per accessi granulari ad agenti, database, chat o altre risorse condivise, applica le regole di visibilita' e modifica nel backend oltre che nell'interfaccia.

## Modello dati e contratti API

- Modifica `prisma/schema.prisma` solo quando il requisito richiede persistenza, vincoli o relazioni nuove. Aggiorna nello stesso intervento i servizi, la validazione, il bootstrap del catalogo quando necessario e i test interessati.
- L'ambiente allinea il database tramite Prisma e gli script di bootstrap. Non aggiungere una strategia di migrazione alternativa senza una decisione esplicita sull'operativita' Docker e sugli ambienti gia' installati.
- Usa transazioni Prisma per operazioni che devono essere atomiche, in particolare quando modificano record correlati, permessi o configurazioni.
- Mantieni il contratto coerente fra controller, DTO/schema di validazione, servizio, tipi frontend e client API. Se il contratto cambia, aggiorna tutti i suoi utilizzatori nella stessa modifica.
- Gestisci esplicitamente risorsa assente, risorsa archiviata, conflitto e input non valido con codici HTTP e codici errore coerenti. Non restituire dettagli interni o sensibili.
- Prima di introdurre una cancellazione fisica, verifica il comportamento del dominio. Per molte risorse il comportamento corretto e' archiviazione o soft delete.

## Sicurezza, configurazione e dati

- Non leggere, stampare, incollare, committare o inventare segreti reali: password, token, API key, cookie, credenziali database, contenuti di `.env`, `secrets/`, backup o dati di produzione.
- Per configurazioni usa esclusivamente esempi versionati, come `.env.example`, e valori chiaramente fittizi.
- Le credenziali devono arrivare da variabili d'ambiente o Docker secrets, mai da codice, test, documentazione o file Compose versionati.
- Valida tutti gli input esterni alle frontiere HTTP con gli strumenti gia' adottati dal progetto. Non usare `any` per aggirare una validazione o un errore di tipo.
- Non loggare segreti, token, password, payload personali completi o dettagli tecnici inutili. Gli errori verso il client devono essere utili ma non divulgare informazioni riservate.
- Prima di aggiungere una dipendenza, consulta `docs/APPROVED_LIBRARIES.md`, preferisci librerie gia' presenti e documenta motivazione, impatto e risultato audit.
- Non eseguire comandi distruttivi, operazioni di pulizia dati, push, commit, pubblicazioni o ricostruzioni dell'ambiente senza una richiesta esplicita.

## Frontend e comportamento dell'interfaccia

- Riusa componenti, token CSS, classi e convenzioni Birgus. Mantieni il linguaggio visivo uniforme fra pagine e moduli.
- Per conferme, avvisi e azioni distruttive usa il dialogo Birgus; non usare `alert`, `confirm` o `prompt` nativi del browser.
- Usa `lucide-react` per le icone quando disponibile. Scegli controlli coerenti con l'azione: switch per attivazioni, checkbox per selezioni multiple, radio o selezione vincolata per una sola scelta, menu per insiemi di opzioni.
- Cura stati di caricamento, vuoto, errore, successo e disabilitazione dei comandi asincroni. Il frontend migliora l'esperienza, ma non e' il controllo di sicurezza.
- Mantieni il layout responsivo, senza overflow annidati o scrollbar superflue. Verifica che testi, tabelle, dialoghi e azioni restino utilizzabili anche a larghezze ridotte.
- Per contenuti AI in Markdown, usa il renderer gia' presente e conserva la vista testuale quando la funzionalita' la prevede.

## AI, Brainyware e workflow

- Birgus resta responsabile di utenti, workspace, autorizzazioni, configurazioni e metadati locali. I servizi AI esterni restano responsabili di inferenza e delle proprie risorse remote.
- Un'integrazione esterna deve fallire in modo esplicito e comprensibile quando servizio, rete, endpoint, credenziali o autorizzazioni non sono disponibili. Non simulare risposte di successo e non nascondere errori di contratto.
- Le operazioni stateless non devono creare memoria o sessioni persistenti. Le chat persistenti devono salvare solo identificativi e metadati necessari, sempre limitati a workspace e autorizzazioni.
- Le connessioni a database esterni devono essere read-only salvo requisito esplicito, verificato e protetto. Credenziali e query sensibili non devono raggiungere il browser o i log.
- Un nuovo nodo workflow e' completo solo con catalogo, configurazione validata, autorizzazioni, handler runtime, error handling e test di esecuzione. Non aggiungere solo il nodo grafico.

## Debug e analisi

1. Riproduci il problema con il percorso piu' breve possibile. Raccogli endpoint, stato HTTP, messaggio errore, contesto workspace/ruolo e log rilevanti senza includere segreti.
2. Verifica in sequenza UI, richiesta HTTP, controller, guard, servizio, persistenza e integrazione esterna. Non saltare i guard o il contesto workspace.
3. Confronta payload richiesto e risposta effettiva con gli schemi TypeScript/Zod e con il contratto esterno documentato.
4. Per anomalie di configurazione o rete, controlla prima variabili presenti, raggiungibilita', DNS, porta, autenticazione e URL base; evita modifiche speculative alla logica applicativa.
5. Correggi la causa radice e dimostrala con un test, uno smoke test o una riproduzione documentata.

## Verifiche e consegna

Esegui i controlli proporzionati alla modifica. Per una modifica trasversale, esegui almeno:

```bash
npm run security:check
npm run typecheck
npm test
npm run build
npm --prefix frontend run build
```

Quando sono coinvolti dipendenze, Docker, AI, storage o workflow, esegui anche audit o smoke test specifici disponibili negli script del repository. Se un controllo non e' stato eseguito o e' bloccato dall'ambiente, dichiaralo chiaramente senza presentarlo come superato.

Al termine, riassumi: modifica effettuata, ragione tecnica, file principali, comportamento risultante, verifiche eseguite e limiti o rischi residui. Non creare commit, tag o push salvo richiesta esplicita.
