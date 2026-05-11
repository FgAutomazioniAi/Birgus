# SQL operativo modulo agenti

## Leggere tutti gli agenti di modulo
```sql
SELECT
  ma.id,
  m.key AS module_key,
  ma.key AS agent_key,
  ma.name,
  ma.label,
  ma.is_enabled,
  ma.updated_at
FROM module_agents ma
JOIN modules m ON m.id = ma.module_id
WHERE ma.workspace_id = 'WORKSPACE_UUID'
  AND ma.deleted_at IS NULL
ORDER BY m.key, ma.label;
```
Descrizione:
- elenca gli agenti di modulo di un workspace.

## Inserire un agente di modulo
```sql
INSERT INTO module_agents (
  id,
  workspace_id,
  module_id,
  key,
  name,
  label,
  original_prompt,
  active_prompt,
  is_enabled,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'WORKSPACE_UUID',
  (SELECT id FROM modules WHERE key = 'ddt_processing'),
  'ddt_analysis_prompt',
  'ddt_analysis_prompt',
  'Prompt analisi DDT',
  'PROMPT_ORIGINALE',
  'PROMPT_ORIGINALE',
  true,
  'USER_UUID',
  'USER_UUID',
  NOW(),
  NOW()
);
```
Descrizione:
- crea un agente collegandolo formalmente a un modulo esistente nel workspace.

Nota:
- per agganciare il prompt reale del DDT Reader usa:
  - `module key = 'ddt_processing'`
  - `agent key = 'ddt_analysis_prompt'`
- per agganciare il prompt reale del generatore preventivi usa:
  - `module key = 'project_management'`
  - `agent key = 'quotation_structuring_prompt'`

## Aggiornare il prompt attivo di un agente
```sql
UPDATE module_agents
SET active_prompt = 'NUOVO_PROMPT_ATTIVO',
    updated_by_user_id = 'USER_UUID',
    updated_at = NOW()
WHERE id = 'AGENT_UUID'
  AND workspace_id = 'WORKSPACE_UUID'
  AND deleted_at IS NULL;
```
Descrizione:
- sostituisce il prompt attualmente in uso per un agente specifico.

## Resettare il prompt attivo all originale
```sql
UPDATE module_agents
SET active_prompt = original_prompt,
    updated_by_user_id = 'USER_UUID',
    updated_at = NOW()
WHERE id = 'AGENT_UUID'
  AND workspace_id = 'WORKSPACE_UUID'
  AND deleted_at IS NULL;
```
Descrizione:
- riporta il prompt attivo al prompt originale salvato.

## Disabilitare o riabilitare un agente
```sql
UPDATE module_agents
SET is_enabled = false,
    updated_by_user_id = 'USER_UUID',
    updated_at = NOW()
WHERE id = 'AGENT_UUID'
  AND workspace_id = 'WORKSPACE_UUID'
  AND deleted_at IS NULL;
```
Descrizione:
- spegne logicamente un agente mantenendo il record nel database.

## Abilitare il modulo Agenti per un workspace
```sql
UPDATE workspace_modules
SET is_enabled = true,
    configured_at = NOW(),
    configured_by_user_id = 'USER_UUID'
WHERE workspace_id = 'WORKSPACE_UUID'
  AND module_id = (SELECT id FROM modules WHERE key = 'agent_management');
```
Descrizione:
- abilita la vista/modulo Agenti nel workspace.

## Negare il modulo Agenti a un utente specifico
```sql
INSERT INTO user_module_overrides (
  workspace_id,
  user_id,
  module_id,
  mode,
  reason,
  configured_by_user_id,
  configured_at
)
VALUES (
  'WORKSPACE_UUID',
  'TARGET_USER_UUID',
  (SELECT id FROM modules WHERE key = 'agent_management'),
  'DENY',
  'Nasconde il modulo Agenti a questo utente',
  'ADMIN_USER_UUID',
  NOW()
)
ON CONFLICT (workspace_id, user_id, module_id)
DO UPDATE SET
  mode = EXCLUDED.mode,
  reason = EXCLUDED.reason,
  configured_by_user_id = EXCLUDED.configured_by_user_id,
  configured_at = EXCLUDED.configured_at;
```
Descrizione:
- crea o aggiorna un override utente per nascondere il modulo Agenti.
