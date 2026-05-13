# Frontend Integration - Modulo Agenti

## Scopo
Gestire prompt attivi/originali degli agenti di modulo usati realmente dai workflow backend.

## Accesso
- Modulo richiesto: `agent_management`
- Permessi:
- `agents.read`
- `agents.write`

## Endpoints
Base: `/api/agents`

### Lista agenti
- `GET /api/agents`
- Response:
- `workspaceId`
- `agents[]`: `id,moduleId,moduleKey,moduleName,key,name,label,originalPrompt,activePrompt,isEnabled,createdAt,updatedAt`

### Aggiorna prompt attivo
- `PATCH /api/agents/:agentId`
- Body:
```json
{ "activePrompt": "..." }
```

### Reset prompt
- `POST /api/agents/:agentId/reset-prompt`

## Regole backend
- `activePrompt` non può essere vuoto (`MODULE_AGENT_PROMPT_EMPTY`).
- `agentId` obbligatorio (`MODULE_AGENT_ID_REQUIRED`).
- Agente inesistente -> `MODULE_AGENT_NOT_FOUND`.

## Collegamento con Workflow
I nodi `AGENT` nei workflow referenziano questi record con `moduleAgentId`.
Se un agente viene modificato, il comportamento del workflow che lo usa cambia immediatamente nelle esecuzioni future.

## Seed iniziale
- `ddt_processing: ddt_analysis_prompt`
- `project_management: quotation_structuring_prompt`

## Errori frequenti
- `400 MODULE_AGENT_ID_REQUIRED`
- `400 MODULE_AGENT_PROMPT_EMPTY`
- `404 MODULE_AGENT_NOT_FOUND`
- `403 MODULE_DISABLED`
- `403 PERMISSION_DENIED`
- `400 VALIDATION_ERROR`

## Note handoff
- Raggruppare UI per `moduleKey`
- Mostrare sempre `originalPrompt` e `activePrompt`
- Conferma esplicita prima del reset
- Gestire gating modulo con `GET /api/modules/users/:userId`
