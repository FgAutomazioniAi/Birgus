# Workflow Guardrails Spec (Node-RED like, safe by design)

## Obiettivo
Permettere agli utenti abilitati di configurare il comportamento dei moduli via canvas (React Flow), mantenendo il backend robusto e senza possibilità di configurazioni distruttive.

## Principio
Configurabilità controllata:
- l'utente modifica ordine e presenza dei blocchi
- il backend esegue solo nodi/tool/agent registrati
- i nodi critici non possono essere rimossi

## Modello dati (senza nuove tabelle)
È stato esteso il modello esistente `module_workflow_nodes` con:
- `is_required BOOLEAN NOT NULL DEFAULT false`

Questo flag indica un nodo critico da preservare.

## Regole hard backend

### 1) Nodo critico non rimovibile
Durante `saveWorkflowDefinition`:
- se un nodo con `is_required=true` manca nel payload update
- il backend lo reinserisce automaticamente nella definizione salvata
- quindi il nodo rimane nel canvas al successivo `GET /api/workflows/:id`

### 2) Nodo critico sempre attivo
- se `is_required=true`, il backend forza `is_enabled=true`
- non è possibile disattivarlo tramite payload

### 3) Integrità nodo-kind
Validazione input API workflow:
- `nodeKind=AGENT` richiede `moduleAgentId`
- `nodeKind=TOOL` richiede `moduleToolId`

## Seed iniziale nodi critici
Impostati con `isRequired=true`:
- `project_management / quotation_document_pipeline`
- `quotation_pdf_input`
- `quotation_ocr_tool`
- `quotation_structuring_agent`
- `quotation_docx_builder_tool`
- `quotation_delivery_output`

Nodo opzionale (rimovibile):
- `quotation_mail_delivery_tool` (`isRequired=false`)

Impostati critici nel DDT pipeline:
- `ddt_pdf_input`
- `ddt_ocr_tool`
- `ddt_analysis_agent`
- `ddt_knowledge_index_tool`
- `ddt_analysis_output`

## Impatto API

### Input workflow node
Nuovo campo supportato:
- `isRequired: boolean` (default `false`)

### Output workflow node
Ora il backend restituisce anche:
- `isRequired: boolean`

## UX consigliata frontend
- rendere non eliminabili i nodi con `isRequired=true`
- impedire toggle off su `isRequired=true`
- se l'utente tenta azione non valida, mostrare hint locale
- in ogni caso il backend rimane source of truth

## Stato esecuzione workflow
Questa specifica governa la configurazione del grafo.
I run sono creati in `QUEUED` ma vengono eseguiti automaticamente dall'executor backend.
Progressione attesa: `QUEUED -> RUNNING -> COMPLETED|FAILED|CANCELED`.
In caso di input mancanti o errori tool/agent, il run passa a `FAILED` con dettaglio su `error_message` del run e sugli step.
