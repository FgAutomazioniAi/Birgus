# SQL operativo modulo agenti

## Leggere tutti gli agenti con progetto e modulo
```sql
SELECT
  pa.id,
  p.name AS project_name,
  m.key AS module_key,
  pa.key AS agent_key,
  pa.name,
  pa.label,
  pa.is_enabled,
  pa.updated_at
FROM project_agents pa
JOIN projects p ON p.id = pa.project_id
JOIN modules m ON m.id = pa.module_id
WHERE pa.workspace_id = 'WORKSPACE_UUID'
  AND pa.deleted_at IS NULL
  AND p.deleted_at IS NULL
ORDER BY p.name, m.key, pa.label;
```
Descrizione:
- elenca gli agenti di un workspace con progetto e modulo associato.

## Inserire un agente per un progetto
```sql
INSERT INTO project_agents (
  id,
  workspace_id,
  project_id,
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
  'PROJECT_UUID',
  (SELECT id FROM modules WHERE key = 'ddt_processing'),
  'ddt_reader_agent',
  'ddt_reader_agent',
  'DDT Reader Agent',
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
- crea un agente di progetto collegandolo formalmente a un modulo esistente.

Nota:
- per agganciare il prompt reale del DDT Reader usa:
  - `module key = 'ddt_processing'`
  - `agent key = 'ddt_analysis_prompt'`
- per agganciare il prompt reale del generatore preventivi usa:
  - `module key = 'project_management'`
  - `agent key = 'quotation_structuring_prompt'`

## Aggiornare il prompt attivo di un agente
```sql
UPDATE project_agents
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
UPDATE project_agents
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
UPDATE project_agents
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
- applica un override utente per non mostrare il modulo Agenti.
