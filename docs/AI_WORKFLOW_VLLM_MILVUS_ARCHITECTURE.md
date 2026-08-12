# Birgus - Piano architetturale IA, workflow, vLLM e Milvus

Aggiornato: 2026-07-23.

Questo documento e la traccia operativa per trasformare Birgus in una soluzione piu stabile, modulare e governabile. Deve essere letto insieme alle regole PDF di sviluppo sicuro gia recepite in:

- `docs/CODING_STYLE_SECURITY.md`
- `docs/APPROVED_LIBRARIES.md`
- `docs/SECURITY_EXCEPTION_TEMPLATE.md`

## Obiettivo

Costruire un MVP concreto in cui:

- Postgres resta il database applicativo originale e sistema di record.
- Garage resta lo storage binario per documenti, immagini e file originali.
- Milvus diventa il database vettoriale operativo per memoria, documentale e knowledge.
- vLLM diventa il primo motore di inferenza interno, esposto solo alla rete Docker privata.
- Il backend Nest orchestra sicurezza, autorizzazioni, persistenza applicativa e stato run.
- Python Modules diventa il runtime esecutivo dei workflow IA tramite LangChain/LangGraph e tool Python.
- Il workflow diventa la descrizione primaria dei passaggi di modulo, sotto forma di JSON validato.
- La struttura resta ad oggetti, con file piccoli e responsabilita chiare.

Non e obiettivo del primo MVP integrare subito provider esterni con API key cliente o il futuro motore IA interno. Il design deve pero prevedere questa estensione senza riscrivere workflow, tool e servizi di dominio.

## Fonti tecniche verificate

- vLLM espone un server OpenAI-compatible e supporta Docker: https://docs.vllm.ai/en/stable/serving/online_serving/
- vLLM Docker image e runtime non-root: https://docs.vllm.ai/en/latest/deployment/docker/
- vLLM structured output con `response_format.type=json_schema`: https://docs.vllm.ai/en/latest/features/structured_outputs/
- vLLM input multimodali via `image_url`: https://docs.vllm.ai/en/latest/features/multimodal_inputs/
- vLLM security: `--api-key` protegge gli endpoint OpenAI-compatible, ma non basta come misura unica: https://docs.vllm.ai/en/stable/usage/security/
- Milvus e database vettoriale con schema, scalar fields, vector fields e metadati filtrabili: https://milvus.io/docs/overview.md
- Milvus standalone Docker: https://milvus.io/docs/install_standalone-docker.md
- Milvus schema design: https://milvus.io/docs/schema.md
- LangGraph e indicato per workflow/agenti stateful, duraturi e con passaggi deterministici + agentic: https://docs.langchain.com/oss/python/langgraph/overview
- LangChain tools sono funzioni con input/output ben definiti e schema: https://docs.langchain.com/oss/python/langchain/tools

## Stato attuale rilevato nel codice

### IA e LM

Punti principali:

- `src/modules/orchestration/services/LmStudioClient.ts`
- `src/modules/conversational-assistant/services/LmStudioChatClient.ts`
- `src/modules/ddt-processing/services/LmStudioDdtAnalyzer.ts`
- `src/modules/measure-report/services/MeasureReportAnalyzer.ts`
- `src/modules/document-intelligence/services/KnowledgeEmbeddingService.ts`

Osservazioni:

- Stato iniziale superato dalle Fasi 1-3: i client applicativi usano provider OpenAI-compatible.
- I vecchi nomi `LmStudioClient`, `LmStudioChatClient` e `LmStudioDdtAnalyzer` restano solo come compatibilita nominale temporanea.
- Il DDT non usa piu `/api/v1/chat`; usa `/v1/chat/completions` con `response_format` JSON schema.
- Header `Authorization: Bearer ...` supportato tramite `AI_PROVIDER_API_KEY`/`VLLM_API_KEY`.
- Gli errori e i log sono mantenuti redatti, senza prompt completi o payload IA raw.

### Workflow

Punti principali:

- `prisma/schema.prisma`: `ModuleWorkflow`, `ModuleWorkflowNode`, `ModuleWorkflowEdge`, `ModuleWorkflowRun`, `ModuleWorkflowRunStep`.
- `src/modules/workflows/services/WorkflowRunExecutorService.ts`.
- `src/modules/workflows/services/WorkflowService.ts`.
- `src/modules/workflows/infra/PrismaWorkflowRepository.ts`.

Osservazioni:

- Esiste gia un modello workflow con nodi, edge, run e step.
- L'executor attuale contiene logica specifica per DDT, preventivi e measure report.
- Il target deve spostare la logica specifica dentro tool/agent runtime, lasciando al backend un ruolo di orchestratore e audit.

### Knowledge e vettori

Punti principali:

- `prisma/schema.prisma`: `KnowledgeDocument`, `KnowledgeChunk`, `embedding_vector Unsupported("vector")?`.
- `src/modules/document-intelligence/services/DocumentIntelligenceService.ts`.
- `src/modules/document-intelligence/infra/PrismaKnowledgeRepository.ts`.
- `src/modules/document-intelligence/repositories/KnowledgeRepository.ts`.

Osservazioni:

- Postgres conserva oggi documento knowledge, chunk e vettore.
- La ricerca semantica usa SQL raw su `knowledge_chunks.embedding_vector`.
- Il target richiede separazione: Postgres mantiene metadati/stato, Milvus contiene vettori e payload operativo ricercabile.

### Garage e documenti

Punti principali:

- `src/storage/GarageObjectStorage.ts`.
- `src/storage/ProjectBinaryStorage.ts`.
- `python_modules/app/services/storage_service.py`.
- moduli OCR/measure report Python.

Osservazioni:

- Garage resta adatto come storage autorevole dei binari originali.
- Milvus non deve diventare storage binario. Deve contenere chunk, embedding e metadati sufficienti alla ricerca IA.
- I riferimenti a Garage devono essere salvati come `storage_path`, `document_id`, hash e metadata.

### Python Modules

Punti principali:

- `python_modules/app/api/routes.py`
- `python_modules/app/models.py`
- `python_modules/app/modules/base.py`
- `python_modules/app/modules/registry.py`

Osservazioni:

- Esiste gia un endpoint generico `POST /v1/modules/execute`.
- Il protocollo attuale e semplice: `module`, `action`, `input`.
- Per workflow agentici serve un runtime nuovo, senza perdere compatibilita con i moduli esistenti.

## Principi architetturali obbligatori

1. Postgres non deve ospitare piu vettori nel target finale.
2. Garage conserva solo file originali e derivati binari.
3. Milvus ospita chunk ricercabili, embedding e metadati operativi per retrieval.
4. Nessun modulo deve dipendere direttamente da vLLM: deve dipendere da interfacce.
5. I client IA devono essere provider-agnostic.
6. Il workflow JSON deve essere validato prima di essere salvato o eseguito.
7. I tool devono avere input/output schema chiari.
8. Python esegue tool e catene agentiche; Nest mantiene autorizzazioni, audit e stato.
9. Ogni step produce evidenza: run, step, input/output redatti, tempi, stato.
10. Ogni PR deve rispettare le regole PDF: descrizione, motivazione, test, impatti sicurezza/dati/config.

## Architettura target

### Vista logica

```text
Frontend
  |
  v
Nest Backend
  - auth, RBAC, workspace isolation
  - workflow definition API
  - workflow run state
  - Postgres repositories
  - Garage repositories
  - Milvus metadata sync coordinator
  |
  +--> Postgres
  |      dati applicativi, workflow, run, audit, riferimenti knowledge
  |
  +--> Garage
  |      file originali e derivati binari
  |
  +--> Python Modules
         - LangGraph/LangChain runtime
         - tool registry
         - document extraction
         - Milvus vector operations
         - calls to AI gateway
             |
             +--> vLLM OpenAI-compatible server
             +--> futuri provider IA interni/cliente tramite stessa interfaccia

Milvus
  - collection knowledge_chunks
  - collection memory_items
  - scalar metadata per filtro workspace/modulo/documento/tag
```

### Confini

Postgres:

- utenti, ruoli, permessi;
- moduli, agenti, workflow definition, workflow run e step;
- document archive e riferimenti a Garage;
- knowledge document come record applicativo;
- audit e notifiche;
- configurazioni provider IA senza segreti in chiaro.

Garage:

- PDF originali;
- immagini renderizzate da PDF;
- DOCX/PDF generati;
- payload grandi non adatti a Postgres;
- eventuali artifact di workflow.

Milvus:

- chunk testuali indicizzati;
- embedding dense, e in futuro sparse/hybrid;
- metadata filtrabili;
- memory items di conversazioni e agenti;
- riferimenti a Postgres/Garage.

Python:

- tool execution;
- LangGraph graph runner;
- text extraction/OCR;
- chunking avanzato;
- embedding generation;
- write/search Milvus;
- chiamate IA al provider configurato.

Nest:

- autorizzazione;
- validazione API;
- salvataggio workflow;
- avvio run;
- persistenza stato run/step;
- coordinamento con Python;
- non deve contenere catene IA lunghe o tool Python-specific.

## Pacchetti e oggetti da introdurre

### Backend TypeScript

Nuovo package `src/modules/ai-runtime`.

File consigliati:

- `domain/AiProvider.ts`
- `domain/AiModelCapability.ts`
- `domain/AiChatMessage.ts`
- `domain/AiChatRequest.ts`
- `domain/AiChatResponse.ts`
- `domain/AiToolDefinition.ts`
- `domain/AiProviderConfig.ts`
- `services/AiGatewayService.ts`
- `services/AiProviderRegistry.ts`
- `services/OpenAiCompatibleChatClient.ts`
- `services/VllmHealthService.ts`
- `repositories/AiProviderConfigRepository.ts`
- `infra/PrismaAiProviderConfigRepository.ts`

Responsabilita:

- `AiGatewayService`: unica porta backend per completions, structured output, multimodal, embeddings se servite da provider.
- `AiProviderRegistry`: sceglie provider in base a workspace/modulo/config.
- `OpenAiCompatibleChatClient`: implementa HTTP OpenAI-compatible con base URL, API key, path, timeout, modello.
- `VllmHealthService`: verifica `/v1/models` e disponibilita modello.
- `AiProviderConfigRepository`: salva configurazioni senza esporre segreti.

I vecchi nomi `LmStudioClient` e `LmStudioChatClient` devono essere rimossi o trasformati in adapter deprecati. Il codice applicativo deve dipendere da `AiGatewayService`.

### Backend workflow

Nuovo package `src/modules/workflow-runtime`.

File consigliati:

- `domain/WorkflowDefinitionSchema.ts`
- `domain/WorkflowNodeType.ts`
- `domain/WorkflowExecutionPlan.ts`
- `domain/WorkflowExecutionContext.ts`
- `services/WorkflowDefinitionValidator.ts`
- `services/WorkflowExecutionPlanner.ts`
- `services/WorkflowRunCoordinator.ts`
- `services/PythonWorkflowRuntimeClient.ts`
- `services/WorkflowStepRecorder.ts`

Responsabilita:

- validare DAG, nodi, edge e condizioni;
- compilare il JSON salvato in un piano eseguibile;
- inviare a Python una richiesta runtime stabile;
- registrare step e stato in Postgres;
- non implementare logica specifica di DDT/measure report dentro l'executor generale.

### Python Modules

Nuovo package `python_modules/app/workflow_runtime`.

File consigliati:

- `schemas.py`
- `runtime.py`
- `graph_builder.py`
- `tool_registry.py`
- `tool_contract.py`
- `ai/provider.py`
- `ai/openai_compatible_client.py`
- `ai/vllm_client.py`
- `knowledge/milvus_client.py`
- `knowledge/document_indexer.py`
- `knowledge/chunker.py`
- `knowledge/tagger.py`
- `knowledge/retriever.py`
- `memory/memory_store.py`

Responsabilita:

- costruire LangGraph a partire dal workflow JSON validato;
- eseguire tool come runnable;
- comunicare con vLLM via OpenAI-compatible API;
- scrivere e leggere da Milvus;
- usare Garage per caricare file quando un tool richiede bytes;
- restituire output strutturato a Nest.

Endpoint nuovi:

- `POST /v1/workflows/execute`
- `POST /v1/knowledge/index-document`
- `POST /v1/knowledge/search`
- `GET /v1/runtime/health`

L'endpoint vecchio `/v1/modules/execute` resta per compatibilita temporanea.

## Workflow JSON target

Il workflow deve descrivere in modo euristico e validabile i passaggi del modulo.

Schema concettuale:

```json
{
  "workflow_key": "ddt_reader_pipeline",
  "version": 1,
  "module_key": "ddt_reader",
  "inputs": {
    "document_id": "uuid",
    "storage_path": "garage://bucket/key"
  },
  "nodes": [
    {
      "key": "extract_text",
      "type": "tool",
      "runtime": "python",
      "handler": "ocr.extract_text_from_pdf",
      "input_schema": {},
      "output_schema": {}
    },
    {
      "key": "classify_ddt",
      "type": "agent",
      "provider_policy": "default_internal",
      "model_capabilities": ["chat", "structured_output"],
      "prompt_key": "ddt_analysis_prompt",
      "response_schema_key": "ddt_analysis_result"
    },
    {
      "key": "index_knowledge",
      "type": "tool",
      "runtime": "python",
      "handler": "knowledge.index_document"
    }
  ],
  "edges": [
    { "from": "extract_text", "to": "classify_ddt" },
    { "from": "classify_ddt", "to": "index_knowledge" }
  ]
}
```

Regole:

- `key` stabile e univoca nel workflow.
- `type` ammessi: `input`, `tool`, `agent`, `condition`, `output`.
- `runtime` ammessi MVP: `backend`, `python`, `ai`.
- ogni nodo persistito deve avere schema Zod lato Nest e Pydantic lato Python.
- ogni tool deve dichiarare handler e contratto input/output.
- ogni agente deve dichiarare modello/capability richiesta, non un provider fisso.

## Inferenza IA

### MVP vLLM

Docker dedicato:

- immagine: `vllm/vllm-openai`;
- rete: solo rete interna Docker di Birgus;
- porta interna: `8000`;
- API: `/v1/models`, `/v1/chat/completions`;
- autenticazione: `VLLM_API_KEY` + firewall/rete privata;
- GPU: NVIDIA runtime;
- cache Hugging Face su volume locale.

Configurazione proposta:

```env
AI_PROVIDER=vllm
AI_PROVIDER_BASE_URL=http://vllm:8000/v1
AI_PROVIDER_API_KEY=
AI_PROVIDER_CHAT_MODEL=
AI_PROVIDER_EMBEDDING_MODEL=
AI_PROVIDER_TIMEOUT_MS=600000
AI_PROVIDER_TEMPERATURE=0
VLLM_MODEL=
VLLM_API_KEY=
VLLM_MAX_MODEL_LEN=4096
VLLM_GPU_MEMORY_UTILIZATION=0.82
```

Nota hardware attuale:

- macchina rilevata: RTX 3060 Ti, 8 GB VRAM;
- con 8 GB bisogna partire da modello piccolo/medio quantizzato o comunque compatibile con memoria disponibile;
- LM Studio oggi occupa VRAM, quindi va spento durante test vLLM;
- measure report multimodale richiede modello vision compatibile, da validare separatamente.

### Futuri provider IA

Il backend non deve conoscere direttamente vLLM. Deve conoscere questi tipi:

- `AiProviderKind`: `vllm`, `internal_ai`, `customer_openai_compatible`, `external_managed`.
- `AiCapability`: `chat`, `structured_output`, `tool_calling`, `multimodal_image`, `embedding`, `rerank`.
- `AiRoutingPolicy`: default workspace, override modulo, override workflow node.

Nel MVP si implementa solo `vllm`, ma i contratti devono gia permettere:

- provider interno futuro;
- provider cliente con API key;
- modello diverso per modulo;
- fallback controllato solo se configurato.

### Cosa migrare da LM Studio

1. Rinominare `LmStudioClient` in `OpenAiCompatibleLmClient`.
2. Rinominare `LmStudioChatClient` in `OpenAiCompatibleToolChatClient`.
3. Cambiare errori/log da `LM Studio` a `AI provider`.
4. Aggiungere `Authorization: Bearer` quando `AI_PROVIDER_API_KEY` e valorizzata.
5. Portare DDT da `/api/v1/chat` a `/v1/chat/completions`.
6. Usare structured output JSON schema per DDT, preventivi e measure report quando possibile.
7. Introdurre health check su modello richiesto.

## Milvus come database operativo IA

### Collezioni MVP

Collection `knowledge_chunks`.

Campi:

- `id`: VarChar primary key, UUID del chunk logico o UUID generato.
- `workspace_id`: VarChar.
- `module_key`: VarChar nullable.
- `document_id`: VarChar nullable, riferimento Postgres.
- `knowledge_document_id`: VarChar, riferimento Postgres.
- `source_entity_type`: VarChar.
- `source_entity_id`: VarChar.
- `storage_path`: VarChar nullable, riferimento Garage.
- `content_hash`: VarChar.
- `chunk_index`: Int64.
- `chunk_text`: VarChar, limitato.
- `summary_text`: VarChar nullable.
- `tags`: Array/JSON o VarChar serializzato se necessario.
- `metadata`: JSON.
- `embedding_model`: VarChar.
- `embedding_dimensions`: Int64.
- `embedding`: FloatVector.
- `created_at`: VarChar ISO o timestamp supportato.
- `updated_at`: VarChar ISO o timestamp supportato.

Collection `memory_items`.

Campi:

- `id`
- `workspace_id`
- `user_id`
- `session_id`
- `module_key`
- `memory_type`: `preference`, `fact`, `task_state`, `conversation_summary`
- `content_text`
- `tags`
- `metadata`
- `embedding_model`
- `embedding`
- `created_at`
- `expires_at`

### Relazione Postgres/Milvus

Postgres conserva:

- `KnowledgeDocument`;
- stato estrazione;
- hash contenuto;
- riferimenti a documenti e moduli;
- eventuale preview testuale;
- stato di sync verso Milvus.

Milvus conserva:

- chunk testuali ricercabili;
- vettori;
- metadata operativi per filtri;
- riferimenti agli ID Postgres e Garage.

Modifica DB consigliata:

- aggiungere su `KnowledgeChunk` campi `vector_store_provider`, `vector_collection`, `vector_id`, `vector_synced_at`, `vector_sync_status`, `vector_sync_error`;
- rimuovere l'uso runtime di `embedding_vector`;
- mantenere temporaneamente `embedding_vector` solo per migrazione e rollback, poi eliminarlo in una fase successiva.

### Best method per salvare conoscenza

Pipeline consigliata:

1. Ingestione file in Garage.
2. Creazione record Postgres `Document`.
3. Estrazione testo/OCR in Python.
4. Normalizzazione testo.
5. Segmentazione chunk con overlap.
6. Arricchimento metadata.
7. Tagging automatico leggero.
8. Embedding.
9. Upsert Postgres metadata knowledge.
10. Upsert Milvus chunk/vector.
11. Validazione search smoke test.

Metadata minimi per ogni chunk:

- `workspace_id`
- `module_key`
- `source_entity_type`
- `source_entity_id`
- `document_id`
- `storage_path`
- `file_name`
- `mime_type`
- `content_hash`
- `chunk_index`
- `page_start`, `page_end` quando disponibili
- `language`
- `document_type`
- `security_scope`
- `created_by_user_id`

Tag consigliati:

- tag di origine: `ddt`, `preventivo`, `measure_report`, `cliente`, `progetto`, `spedizione`;
- tag semantici: `ordine`, `materiale`, `misura`, `anomalia`, `commessa`, `magazzino`;
- tag operativi: `ocr`, `estratto`, `validato`, `da_verificare`, `errore_parziale`;
- tag accesso: `workspace:{id}`, `module:{key}`, `project:{id}`.

Regola: i tag aiutano filtering e retrieval, ma non sostituiscono RBAC. Il filtro per `workspace_id` e permessi modulo deve essere sempre imposto da backend o runtime.

### Ricerca

MVP:

- semantic search dense in Milvus;
- filtro obbligatorio per `workspace_id`;
- filtri opzionali per modulo, documento, source entity, tag;
- fallback keyword Postgres solo temporaneo.

Fase successiva:

- hybrid search con dense + keyword/BM25;
- reranking;
- caching query frequenti;
- valutazioni retrieval con dataset di domande attese.

## Workflow come nuova logica backend

Target:

- ogni modulo importante ha un workflow default;
- il backend non chiama direttamente analyzer specifici, ma avvia workflow;
- il workflow descrive passaggi, tool, agenti e output;
- Python esegue tool/agenti in base al grafo;
- Nest registra run e step.

Esempio DDT target:

```text
upload_pdf
  -> validate_pdf
  -> extract_text
  -> classify_ddt_structured
  -> persist_ddt_result
  -> index_knowledge_milvus
  -> notify_user
```

Esempio measure report target:

```text
upload_pdf
  -> render_pages
  -> select_candidate_pages
  -> analyze_with_vision_model
  -> persist_measure_rows
  -> index_knowledge_milvus
  -> notify_user
```

Esempio assistente:

```text
receive_message
  -> retrieve_workspace_memory
  -> retrieve_document_knowledge
  -> choose_tools
  -> execute_tools
  -> answer_with_citations
  -> store_memory_if_allowed
```

## API Nest verso Python runtime

Request:

```json
{
  "run_id": "uuid",
  "workspace_id": "uuid",
  "module_key": "ddt_reader",
  "workflow": {},
  "input": {},
  "auth_context": {
    "user_id": "uuid",
    "permissions": []
  },
  "provider_policy": {
    "kind": "vllm",
    "base_url": "http://vllm:8000/v1",
    "model": "model-id",
    "capabilities": ["chat", "structured_output"]
  }
}
```

Response:

```json
{
  "ok": true,
  "run_id": "uuid",
  "status": "completed",
  "steps": [],
  "output": {},
  "metrics": {
    "duration_ms": 1234,
    "prompt_tokens": 0,
    "completion_tokens": 0
  }
}
```

Requisiti:

- input e output validati con Pydantic;
- nessun segreto restituito;
- errori 500 generici verso Nest, dettagli solo nei log server redatti;
- correlation id su ogni chiamata;
- timeout per workflow e per singolo tool.

## Docker target

File consigliati:

- `docker-compose.vllm.yml`
- `docker-compose.milvus.yml`
- eventuale `docker-compose.ai.yml` che include entrambi.

Servizi MVP:

- `vllm`
- `milvus`
- `attu` solo profilo dev, non produzione
- `python_modules` con dipendenze LangChain/LangGraph/PyMilvus
- `app` Nest configurata con URL interni

Esempio indicativo vLLM:

```yaml
services:
  vllm:
    image: vllm/vllm-openai:latest
    container_name: birgus_vllm
    ipc: host
    gpus: all
    environment:
      VLLM_API_KEY: "${VLLM_API_KEY:?VLLM_API_KEY is required}"
      HF_TOKEN: "${HF_TOKEN:-}"
    volumes:
      - "${HF_HOME:-./.cache/huggingface}:/home/vllm/.cache/huggingface"
    command:
      - "--model"
      - "${VLLM_MODEL:?VLLM_MODEL is required}"
      - "--host"
      - "0.0.0.0"
      - "--port"
      - "8000"
      - "--api-key"
      - "${VLLM_API_KEY}"
      - "--max-model-len"
      - "${VLLM_MAX_MODEL_LEN:-4096}"
      - "--gpu-memory-utilization"
      - "${VLLM_GPU_MEMORY_UTILIZATION:-0.82}"
    expose:
      - "8000"
```

Produzione:

- non pubblicare `8000` verso host se non strettamente necessario;
- usare rete Docker privata;
- firewall: esporre solo frontend/API/reverse proxy;
- secret in `.env` non versionati;
- health check su `/health` e `/v1/models`.

## Roadmap operativa

### Fase 0 - Decisioni tecniche

- Scegliere modello vLLM MVP compatibile con 8 GB VRAM.
- Scegliere modello embedding e dimensione.
- Decidere se Milvus MVP e standalone o compose ufficiale completo.
- Stabilire retention memoria conversazionale.
- Definire naming provider/config.

Output:

- `docs/AI_WORKFLOW_VLLM_MILVUS_ARCHITECTURE.md` approvato.
- PR con solo documentazione e config skeleton, se necessario.

### Fase 1 - AI provider abstraction

- Creare `src/modules/ai-runtime`.
- Introdurre `AiGatewayService`.
- Creare `OpenAiCompatibleChatClient`.
- Aggiungere API key header.
- Migrare `LmStudioClient` e `LmStudioChatClient` a provider agnostic.
- Aggiornare env da `ORCH_LM_*` verso `AI_PROVIDER_*`, mantenendo alias temporanei.
- Test unitari client con fetch mock.

Acceptance:

- `npm run typecheck` OK.
- `npm test` OK.
- test client coprono success, 401, timeout, risposta vuota, structured output.

### Fase 2 - vLLM Docker MVP - completata

- Aggiunto `docker-compose.vllm.yml`.
- Aggiunto env example per `VLLM_*` e `AI_PROVIDER_*`.
- Collegata `app` a `http://vllm:8000/v1`.
- Aggiunto health endpoint backend per provider IA.
- Documentato come spegnere LM Studio prima del test.
- Test runtime eseguito con `Qwen/Qwen2-VL-2B-Instruct`, servito da vLLM come `demo-vl`.

Acceptance:

- `docker compose -f docker-compose.yml -f docker-compose.vllm.yml config` OK.
- `GET /v1/models` risponde con modello richiesto.
- smoke test chat completions produce testo.
- `npm run ai:smoke` OK contro provider vLLM reale.

### Fase 3 - Migrazione DDT da LM Studio a OpenAI-compatible - completata

- `LmStudioDdtAnalyzer` e stato reso adapter OpenAI-compatible.
- Usa `/v1/chat/completions`.
- Usa `response_format` JSON schema.
- Valida output con schema applicativo Zod.
- I testi UI sono stati aggiornati da "LM Studio" a "IA/provider IA".

Acceptance:

- test DDT analisi con provider fake: OK.
- test parsing JSON schema: OK.
- nessun riferimento runtime obbligatorio a `/api/v1/chat`: OK.

### Fase 4 - Milvus MVP

- Aggiungere client Milvus Python.
- Aggiungere `MilvusKnowledgeVectorStore`.
- Creare bootstrap collection `knowledge_chunks`.
- Modificare `DocumentIntelligenceService` per delegare vector write/search al vector store.
- Postgres mantiene metadata e stato sync.
- Migrare semantic search da `PrismaKnowledgeRepository` a Milvus.

Acceptance:

- indicizzazione documento crea record Postgres e vettori Milvus.
- search filtra sempre `workspace_id`.
- delete/refresh documento aggiorna Milvus senza duplicati.
- test con Milvus fake/in-memory per logica applicativa.

### Fase 5 - Knowledge best-method

- Estrarre `DocumentKnowledgePipeline`.
- Estrarre `ChunkingPolicy`.
- Estrarre `KnowledgeTaggingService`.
- Aggiungere metadata/tag standard.
- Aggiungere hash deduplica.
- Aggiungere retry e stato `FAILED/SYNC_FAILED`.

Acceptance:

- stessa sorgente non duplica chunk.
- refresh aggiorna Milvus per `content_hash` cambiato.
- ricerca restituisce source references e snippet.

### Fase 6 - Workflow runtime Python

- Aggiungere `POST /v1/workflows/execute`.
- Introdurre LangGraph per compilare DAG da workflow JSON.
- Mappare nodi Birgus in tool Python.
- Restituire step events a Nest o response finale per MVP.
- Spostare logica specifica da `WorkflowRunExecutorService` a tool/agent.

Acceptance:

- DDT pipeline gira come workflow Python.
- measure report pipeline gira come workflow Python o resta temporaneamente adapter.
- Nest registra run/step senza conoscere dettagli del modulo.

### Fase 7 - Assistente e memoria

- Separare memoria breve da memoria lunga.
- Salvare memoria lunga in Milvus `memory_items`.
- Retrieval documentale e memoria sempre filtrati per workspace/user/module.
- Tool calling attraverso Python runtime o adapter backend controllato.

Acceptance:

- assistente recupera knowledge da Milvus.
- tool calling validato con modello vLLM scelto.
- nessun dato cross-workspace nei risultati.

### Fase 8 - Provider futuri

- Implementare tabella/config provider per workspace.
- Aggiungere provider `customer_openai_compatible`.
- Aggiungere secret handling esterno o cifratura lato backend.
- Introdurre capability negotiation.

Acceptance:

- cambio provider senza modificare workflow.
- test routing provider per workspace/modulo.

## Test richiesti

Backend:

- unit test `AiGatewayService`.
- unit test `OpenAiCompatibleChatClient`.
- unit test `WorkflowDefinitionValidator`.
- unit test `WorkflowExecutionPlanner`.
- integration test provider fake.
- test RBAC su workflow e knowledge.

Python:

- test Pydantic schemas.
- test tool registry.
- test graph builder.
- test Milvus adapter con fake repository.
- smoke test reale opzionale con Milvus/vLLM dietro profilo Docker.

End-to-end:

- upload PDF DDT -> workflow -> output strutturato -> knowledge indicizzata.
- search knowledge -> risultati solo workspace corrente.
- assistente -> retrieval -> risposta con riferimenti.

CI:

- backend typecheck/test/audit.
- frontend build/audit.
- Python lint/test.
- compose config validation per profili AI.

## Rischi e mitigazioni

### Modello non adatto a 8 GB VRAM

Mitigazione:

- partire con modello piccolo;
- `max-model-len=4096`;
- `gpu-memory-utilization` conservativo;
- spegnere LM Studio durante test.

### Tool calling non affidabile sul modello scelto

Mitigazione:

- usare structured output deterministico dove possibile;
- tool calling solo dopo test dedicato;
- fallback a planner deterministico per workflow critici.

### Milvus e Postgres fuori sync

Mitigazione:

- `content_hash`;
- `vector_sync_status`;
- upsert idempotente;
- job di reconciliation.

### Esposizione vLLM

Mitigazione:

- nessuna porta pubblica in produzione;
- rete Docker privata;
- API key obbligatoria;
- firewall e reverse proxy solo se serve;
- non affidarsi solo a `--api-key`.

### Workflow troppo generico

Mitigazione:

- schema forte;
- tool registry con handler whitelisted;
- versionamento workflow;
- test per ogni workflow default.

## Ordine consigliato delle PR

1. Documentazione e config skeleton AI.
2. Provider abstraction e rinomina LM Studio.
3. Docker vLLM MVP e health check.
4. Migrazione DDT a chat completions/JSON schema.
5. Milvus compose/client/schema.
6. Vector store abstraction e migrazione semantic search.
7. Knowledge pipeline con tag e sync status.
8. Python workflow runtime con LangGraph.
9. Migrazione DDT workflow runtime.
10. Migrazione measure report workflow runtime.
11. Assistente con Milvus memory/retrieval.
12. Provider routing futuro.

## Definition of Done MVP

- Birgus parte senza LM Studio.
- vLLM gira in Docker e risponde a `/v1/models` e `/v1/chat/completions`.
- DDT usa provider OpenAI-compatible e non `/api/v1/chat`.
- Knowledge nuova viene salvata in Postgres come metadata e in Milvus come vettori.
- Search knowledge usa Milvus con filtro workspace.
- Workflow default DDT e document intelligence hanno JSON validato.
- Python runtime esegue almeno una pipeline end-to-end.
- CI resta verde.
- Audit produzione resta pulito o con eccezioni documentate.
- Nessun segreto, prompt completo o payload IA raw viene loggato.
