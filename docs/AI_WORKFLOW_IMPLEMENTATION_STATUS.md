# Stato sintetico AI Workflow / vLLM / Milvus

Riferimento esteso: `docs/AI_WORKFLOW_VLLM_MILVUS_ARCHITECTURE.md`.

## Stato fasi

- [x] Fase 0 - Analisi e architettura target.
- [x] Fase 1 - Astrazione provider IA OpenAI-compatible.
- [x] Fase 2 - Docker vLLM MVP e health check.
- [x] Fase 3 - Migrazione DDT da LM Studio a OpenAI-compatible.
- [ ] Fase 4 - Milvus MVP per memoria, documentale e knowledge.
- [ ] Fase 5 - Best-method knowledge: chunk, tag, deduplica, sync state.
- [ ] Fase 6 - Runtime Python workflow/tool/agent.
- [ ] Fase 7 - Migrazione moduli su workflow JSON validato.
- [ ] Fase 8 - Hardening, CI estesa, audit e HTTPS finale.

## Fatto ora

- Creato modulo `src/modules/ai-runtime`.
- Introdotto client OpenAI-compatible configurabile con `AI_PROVIDER_*`.
- Mantenuti alias temporanei `ORCH_LM_*` per compatibilita.
- Aggiunto header `Authorization: Bearer` quando `AI_PROVIDER_API_KEY` e valorizzata.
- Migrati orchestrazione, assistente conversazionale e Measure Report verso il nuovo client.
- Trasformati i vecchi client LM Studio in adapter di compatibilita.
- Normalizzati errori provider, timeout e logging senza payload sensibili.
- Aggiornati `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml` e `README.md`.
- Aggiunti test unitari per success, 401, timeout, risposta vuota, JSON schema e chat senza tool.
- Aggiornate dipendenze vulnerabili: backend audit fix, frontend Next 16.2.11, sharp 0.35.3 via override e tsx 4.23.1.
- Accettate le modifiche standard generate da Next 16 su `frontend/next-env.d.ts` e `frontend/tsconfig.json`.
- Aggiunto `docker-compose.vllm.yml` con servizio vLLM OpenAI-compatible, GPU, cache Hugging Face e API key obbligatoria.
- Collegato l'overlay vLLM all'app con `AI_PROVIDER_BASE_URL=http://vllm:8000/v1`.
- Aggiunto endpoint backend `GET /health/ai-provider`.
- Documentato avvio vLLM MVP nel `README.md`.
- Disabilitato l'avvio automatico di LM Studio nello script `/home/samuel/registrazione_ingressi/start.sh` tramite `START_LMSTUDIO=0` default.
- Provato vLLM reale con `Qwen/Qwen2-VL-2B-Instruct` gia servito da `demo_developer_vllm` come `demo-vl`.
- Aggiunto `npm run ai:smoke` per smoke test ripetibile del provider IA.
- Migrato l'analyzer DDT legacy su client OpenAI-compatible con `/v1/chat/completions`.
- Aggiunto schema DDT condiviso con JSON schema per `response_format` e validazione Zod applicativa.
- Rimossi i default runtime DDT/ORCH verso `/api/v1/chat`.
- Aggiornati testi UI da "LM Studio" a "IA/provider IA".
- Aggiunto test DDT con provider fake che verifica endpoint OpenAI-compatible e JSON schema.

## Verifiche

- `npm run typecheck`: OK.
- `npm test`: OK, 21 test passati.
- `npm run security:check`: OK.
- `npm audit`: OK, 0 vulnerabilita.
- `npm --prefix frontend audit`: OK, 0 vulnerabilita.
- `npm --prefix frontend run build`: OK.
- `docker compose -f docker-compose.yml -f docker-compose.vllm.yml config`: OK con variabili fittizie.
- `docker compose -f docker-compose.prod.yml config`: OK con variabili fittizie.
- Ricerca runtime `LM Studio`/`/api/v1/chat`: OK, nessun riferimento in `src`, `frontend`, env, compose, test o README.
- `curl /v1/models` su vLLM reale: OK, modello `demo-vl`, root `Qwen/Qwen2-VL-2B-Instruct`.
- `curl /v1/chat/completions` su vLLM reale: OK, risposta ricevuta.
- `AI_PROVIDER_BASE_URL=http://127.0.0.1:8000/v1 AI_PROVIDER_API_KEY=demo AI_PROVIDER_CHAT_MODEL=demo-vl npm run ai:smoke`: OK.

## Prossimo blocco

Fase 4: Milvus MVP per memoria, documentale e knowledge.
