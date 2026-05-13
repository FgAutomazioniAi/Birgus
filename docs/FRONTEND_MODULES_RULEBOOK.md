# Rulebook Integrazione Frontend (Chatbot, Agenti, Workflow)

## Contesto
Documento di riferimento unico per chi implementa il frontend dei 3 moduli senza modificare il backend.

## Regole globali
1. Il backend è la source of truth.
2. Modulo visibile solo se `effectiveEnabled=true` in `/api/modules/users/:userId`.
3. Error handling uniforme: leggere `code` e `message`.
4. Nessuna assunzione su comportamento non dichiarato dagli endpoint.

## Workflow - Regole critiche
- I nodi con `isRequired=true` non sono eliminabili (server enforcement).
- I nodi con `isRequired=true` rimangono `isEnabled=true` (server enforcement).
- Nodi `AGENT` richiedono `moduleAgentId`.
- Nodi `TOOL` richiedono `moduleToolId`.
- In update edge usare sempre `sourceNodeKey/targetNodeKey`.

## Agenti - Regole critiche
- Prompt attivo non vuoto.
- Reset riporta a `originalPrompt`.
- Modifiche agente impattano i workflow che referenziano quel `moduleAgentId`.

## Chatbot - Regole critiche
- Sessione chiusa: niente nuovi messaggi.
- Sessioni private dell’utente che le crea.
- Nessuno streaming: risposta atomica con eventuali toolCalls.
- Accesso dati solo via tool backend autorizzati.

## Cosa NON fare lato frontend
- Non tentare bypass di nodi critici workflow.
- Non salvare prompt vuoti.
- Non assumere esito positivo automatico dei run: monitorare sempre lo stato finale e mostrare eventuali errori di step.

## Documenti di dettaglio
- `docs/FRONTEND_CHATBOT_MODULE.md`
- `docs/FRONTEND_AGENTS_MODULE.md`
- `docs/FRONTEND_WORKFLOW_MODULE.md`
- `docs/WORKFLOW_GUARDRAILS_SPEC.md`
