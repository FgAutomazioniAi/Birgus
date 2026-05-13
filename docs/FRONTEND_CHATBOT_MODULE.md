# Frontend Integration - Modulo Chatbot (Conversational Assistant)

## Scopo
Fornire chat per-sessione con memoria locale alla sessione, tool calling governato dal backend e contesto documentale collegabile.

## Accesso
- Modulo richiesto: `conversational_assistant`
- Permessi:
- `assistant.read`
- `assistant.write`

## Endpoints
Base: `/api/assistant`

### Sessioni
- `GET /api/assistant/sessions`
- `POST /api/assistant/sessions`
- `GET /api/assistant/sessions/:sessionId`
- `POST /api/assistant/sessions/:sessionId/close`

### Messaggi
- `GET /api/assistant/sessions/:sessionId/messages`
- `POST /api/assistant/sessions/:sessionId/messages`

## Payload principali
### Creazione sessione
Campi opzionali:
- `moduleKey,title,contextEntityType,contextEntityId,projectId,projectVersionId,clientId,shipmentId,documentId,ddtDocumentId`

### Invio messaggio
```json
{ "content": "..." }
```

## Risposta post messaggio
Ritorna in un’unica risposta:
- `userMessage`
- `assistantMessage`
- `toolCalls[]` (con `status`, `resultPayload`, `deniedReason`)

Non c’è streaming token-by-token.

## Regole backend importanti
- Sessione chiusa non accetta messaggi (`ASSISTANT_SESSION_CLOSED`).
- Sessioni accessibili solo all’utente che le ha aperte (`ASSISTANT_SESSION_FORBIDDEN`).
- Memoria sessione salvata in snapshot (`assistant_memory_snapshots`).

## Tool calling: implicazioni
- Le autorizzazioni sui tool sono verificate server-side tramite moduli+permessi.
- Il modello non accede direttamente al DB: passa dai tool registrati.
- Se `documentId` o `ddtDocumentId` è presente in sessione, la chat usa anche contesto documentale collegato.

## Enum utili
- `AssistantSessionStatus`: `OPEN|CLOSED|ARCHIVED`
- `AssistantMessageRole`: `SYSTEM|USER|ASSISTANT|TOOL`
- `AssistantToolCallStatus`: `REQUESTED|RUNNING|SUCCEEDED|FAILED|DENIED|CANCELED`

## Errori frequenti
- `401 AUTH_TOKEN_REQUIRED`
- `401 AUTH_SESSION_INVALID`
- `403 MODULE_DISABLED`
- `403 PERMISSION_DENIED`
- `404 ASSISTANT_SESSION_NOT_FOUND`
- `403 ASSISTANT_SESSION_FORBIDDEN`
- `409 ASSISTANT_SESSION_CLOSED`
- `400 ASSISTANT_MESSAGE_EMPTY`
- `400 VALIDATION_ERROR`

## Note handoff
- Gating modulo con `GET /api/modules/users/:userId`
- Stato chat guidato da `status` sessione
- Mostrare opzionalmente un pannello debug dei `toolCalls`
