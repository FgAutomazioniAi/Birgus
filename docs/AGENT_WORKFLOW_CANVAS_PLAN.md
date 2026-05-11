# Agent Workflow Canvas Plan

## Obiettivo
Predisporre una futura sezione `Agenti` organizzata per modulo applicativo, dove ogni modulo possa mostrare e gestire uno o piu workflow visuali. Gli agenti non sono entita collegate ai progetti: sono configurazioni di workspace collegate ai moduli funzionali (`project_management`, `ddt_processing`, `shipment_management`, ecc.).

## Modello concettuale
Ogni sezione modulo mostrera:
- il nome funzionale del modulo
- uno o piu workflow disponibili per quel modulo
- per ciascun workflow, un canvas stile React Flow
- nodi di input file
- nodi agente con prompt
- nodi tool applicativi o Python
- nodi output (es. generazione DOCX)

## Esempio modulo Progetti
Workflow ipotizzato:
- 3 input file PDF
- 3 agenti di estrazione dedicati
- 1 agente di consolidamento preventivo
- 1 tool finale di generazione file Word

## Tipi di nodo previsti
### Input nodes
Rappresentano file o dati iniziali.
Esempi:
- PDF preventivo principale
- allegato tecnico
- capitolato
- dati cliente

Campi minimi previsti:
- `nodeType = input`
- `inputKind`
- `acceptedMimeTypes`
- `isRequired`
- `label`

### Agent nodes
Rappresentano entita dotate di prompt e comportamento LLM.
Esempi:
- analizzatore DDT
- estrattore preventivo
- sintetizzatore finale

Campi minimi previsti:
- `nodeType = agent`
- `agentKey`
- `moduleAgentId`
- `label`
- `promptSource`
- `modelConfigRef`
- `isEnabled`

### Tool nodes
Rappresentano funzioni applicative o moduli esecutivi.
Esempi:
- OCR Python
- parser strutturato
- semantic search
- generatore DOCX
- invio mail

Campi minimi previsti:
- `nodeType = tool`
- `toolKey`
- `runtimeKind` (`backend`, `python_module`, `next_orchestrator`)
- `label`
- `inputContract`
- `outputContract`

### Output nodes
Rappresentano il risultato finale del workflow.
Esempi:
- file Word generato
- JSON strutturato
- documento salvato in Garage
- notifica o mail inviata

Campi minimi previsti:
- `nodeType = output`
- `outputKind`
- `label`
- `persistenceTarget`

## Regole architetturali
- Il workflow appartiene a un modulo, non a un progetto.
- Un agente appartiene a un modulo e puo essere riusato in piu workflow dello stesso modulo.
- I dati runtime del workflow devono passare tramite backend applicativo, non direttamente dal frontend ai servizi esterni.
- I nodi tool devono descrivere chiaramente se eseguono logica:
  - backend applicativa
  - modulo Python
  - orchestratore Next
- Ogni esecuzione workflow dovra essere auditabile.

## Possibili estensioni database future
Questa sezione e solo pianificatoria, non ancora implementata.

Tabelle possibili:
- `module_workflows`
- `module_workflow_nodes`
- `module_workflow_edges`
- `module_workflow_runs`
- `module_workflow_run_steps`
- `module_tool_bindings`
- `module_agent_bindings`

## Separazione responsabilita
### Database
Salva definizione workflow, binding, versioni workflow, run log e audit.

### Backend app
Valida permessi, risolve moduli, esegue tools applicativi, orchestra i passaggi e salva gli esiti.

### Python modules
Espongono tools riusabili come OCR e analisi specialistiche.

### Next / frontend
Visualizza il canvas, permette editing controllato dei workflow e segue lo stato di esecuzione.

## Vincoli funzionali da mantenere
- nessun accesso diretto del modello al database
- nessun accesso diretto del modello a Garage
- prompt gestiti dal database tramite agenti di modulo
- tools autorizzati prima dell'esecuzione
- design compatibile con multi-tenant e moduli abilitabili per workspace/utente

## Priorita future consigliate
1. Completare il modello `module_agents` nel frontend e nella pagina Agenti.
2. Introdurre concetto di `workflow` a livello modulo.
3. Modellare nodi ed edge nel database.
4. Creare un registry centralizzato dei tool eseguibili.
5. Collegare i workflow ai documenti e alle esecuzioni reali.
6. Aggiungere cronologia run, debug e replay controllato.
