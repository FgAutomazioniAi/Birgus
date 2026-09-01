---
type: module-architecture-review
status: draft
---

# Birgus - Architettura moduli

Apri [[MODULE_DEPENDENCIES.canvas]] per vedere il grafo delle dipendenze attuali.

Le frecce indicano: **il modulo sorgente richiede il modulo di destinazione**.

## Da decidere

- [x] Rimossa la dipendenza [[Modules/agent_management]] -> [[Modules/project_management]].
- [x] Trattare [[Modules/offer_priority]], [[Modules/maintenance_proposals]] e [[Modules/maintenance_calendar]] come gruppo atomico di attivazione **Pianificazione operativa**.
- [x] Mantenere AI come capability comune: provider alternativo vLLM, Brainyware o OpenAI-compatible.
- [ ] Rendere [[Modules/workflow_management]] indipendente dalla knowledge quando usa solo nodi generici.
- [ ] Rendere [[Modules/conversational_assistant]] utilizzabile anche senza knowledge.
- [ ] Valutare [[Modules/audit_center]] -> [[Modules/notification_center]].
- [ ] Separare moduli backend da visibilita nella sidebar.

## Moduli

### Base e contenuti

- [[Modules/document_archive]]
- [[Modules/document_intelligence]]
- [[Modules/ai_runtime_control]]
- [[Modules/notification_center]]
- [[Modules/audit_center]]
- [[Modules/superadmin_center]]

### Workflow e AI

- [[Modules/agent_management]]
- [[Modules/conversational_assistant]]
- [[Modules/workflow_management]]

### Operativita

- [[Modules/project_management]]
- [[Modules/ddt_processing]]
- [[Modules/measure_report]]

### Anagrafica e pianificazione

- [[Modules/customer_map]]
- [[Modules/offer_priority]]
- [[Modules/maintenance_proposals]]
- [[Modules/maintenance_calendar]]
