# Frontend Integration - Modulo Workflow

## Scopo
Consentire la configurazione del comportamento backend via canvas (React Flow) mantenendo vincoli di sicurezza applicativa lato server.

## Stato attuale
- Backend e database: presenti.
- Frontend workflow: non implementato.
- Esecuzione run: creazione tracciata, executor automatico presente (transizione tipica `QUEUED -> RUNNING -> COMPLETED|FAILED`).

## Accesso e gating
- Modulo richiesto: `workflow_management`
- Permessi:
- `workflows.read` (lettura workflow/tools/runs)
- `workflows.write` (creazione run)
- `workflows.configure` (create/update workflow)
- Verifica visibilità modulo: `GET /api/modules/users/:userId` e uso `effectiveEnabled`.

## Guardrail hard backend (source of truth)
1. Nodi critici con `isRequired=true` non rimovibili
- Se un update non include un nodo critico già salvato, il backend lo reinserisce.

2. Nodi critici sempre attivi
- `isRequired=true` forza anche `isEnabled=true` in persistenza.

3. Integrità nodi
- `nodeKind=AGENT` richiede `moduleAgentId`
- `nodeKind=TOOL` richiede `moduleToolId`

4. Mapping edge in update
- Payload update richiede `sourceNodeKey`/`targetNodeKey`
- La GET dettaglio ritorna edge con `sourceNodeId`/`targetNodeId`
- Il frontend deve mappare `nodeId -> nodeKey` prima del PATCH.

## Endpoints
Base: `/api/workflows`

### Tools
- `GET /api/workflows/tools?moduleKey=<optional>`
- Response `tools[]`: `id,moduleKey,key,name,label,description,runtimeKind,handlerKey,inputSchema,outputSchema,configuration,isEnabled,updatedAt`

### Lista workflow
- `GET /api/workflows?moduleKey=<optional>`
- Response `workflows[]`: `id,moduleKey,key,name,label,description,versionNo,isEnabled,isDefault,updatedAt`

### Dettaglio workflow
- `GET /api/workflows/:workflowId`
- Response:
- campi workflow
- `nodes[]` con `isRequired` incluso
- `edges[]`

`nodes[]` campi:
- `id,nodeKey,nodeKind,label,positionX,positionY,moduleAgentId,moduleToolId,inputKind,outputKind,configuration,inputSchema,outputSchema,isEnabled,isRequired`

### Crea workflow
- `POST /api/workflows`
- Richiede `nodes` con almeno 1 elemento.
- Ogni nodo può includere `isRequired` (default backend `false`).

### Aggiorna workflow
- `PATCH /api/workflows/:workflowId`
- Body parziale.
- Se invii `nodes`, ricordare le regole hard sopra.
- Se invii `edges`, usare key (non id).

### Lista run
- `GET /api/workflows/:workflowId/runs`

### Crea run
- `POST /api/workflows/:workflowId/runs`
- Body opzionale contesto:
- `triggerSource,contextEntityType,contextEntityId,projectId,projectVersionId,clientId,shipmentId,documentId,ddtDocumentId,inputPayload`

### Dettaglio run
- `GET /api/workflow-runs/:runId`
- Include `steps[]` con stato e payload step.

## Enum utili
- `WorkflowNodeKind`: `INPUT|AGENT|TOOL|OUTPUT`
- `WorkflowToolRuntimeKind`: `BACKEND|PYTHON_MODULE|NEXT_ORCHESTRATOR`
- `WorkflowRunStatus`: `QUEUED|RUNNING|COMPLETED|FAILED|CANCELED`
- `WorkflowStepStatus`: `PENDING|RUNNING|SUCCEEDED|FAILED|SKIPPED|CANCELED`

## Seed rilevante (default)
Workflow preconfigurati:
- `project_management: quotation_document_pipeline`
- `ddt_processing: ddt_reader_pipeline`

Nodi critici preventivo (`isRequired=true`):
- `quotation_pdf_input`
- `quotation_ocr_tool`
- `quotation_structuring_agent`
- `quotation_docx_builder_tool`
- `quotation_delivery_output`

Nodo opzionale preventivo:
- `quotation_mail_delivery_tool` (`isRequired=false`)

## Errori frequenti
- `400 WORKFLOW_PATH_PARAM_REQUIRED`
- `400 WORKFLOW_EDGE_INVALID`
- `400 WORKFLOW_NODES_REQUIRED`
- `404 WORKFLOW_NOT_FOUND`
- `404 WORKFLOW_RUN_NOT_FOUND`
- `404 WORKFLOW_MODULE_NOT_FOUND`
- `403 MODULE_DISABLED`
- `403 PERMISSION_DENIED`
- `400 VALIDATION_ERROR`

## Implicazioni UI (solo guida)
- Mostrare lock visuale su `isRequired=true`
- Bloccare delete/toggle client-side per nodi critici
- Ma accettare sempre il backend come verità finale
- Polling run consigliato fino a stato finale (`COMPLETED|FAILED|CANCELED`)
- In caso di contesto incompleto (es. run senza PDF richiesto da un tool), la run può andare in `FAILED` con `errorMessage` e step fallito
