---
key: workflow_management
ui: Workflow
---
# workflow_management

Motore e canvas di automazione generico: definisce grafi, esegue nodi autorizzati, conserva run e mette in attesa i casi che richiedono una decisione umana.

## Backend: blocchi funzionali

- CRUD di workflow, nodi e collegamenti; playground e workflow associati a un modulo.
- Catalogo strumenti/nodi runtime, pianificazione grafo, validazione ingressi/uscite e policy autorizzativa per agente/strumento/modulo.
- Esecuzione sincrona o accodata, stato run/step, output nodi, log e diagnosi.
- Condizioni `Verifica e instrada`, rami V/F, aggregazione input, formattazione testo/email, OCR, AI, documenti, email e knowledge secondo il catalogo abilitato.
- Interventi umani: una decisione sospende la run e la riprende solo dopo l'esito umano.
- Scheduler/canali di consegna; import/export con controllo moduli richiesti nel workspace destinazione.
- API `workflows`, `connected-apps` e servizio interno di esecuzione.

## Dati posseduti

- `ModuleWorkflow`, `ModuleWorkflowNode`, `ModuleWorkflowEdge`.
- `ModuleTool`, `ModuleWorkflowRun`, `ModuleWorkflowRunStep`.
- `HumanIntervention`, `ScheduledWorkflowDelivery`.

## Frontend: blocchi visibili

- Sidebar e pagina **Workflow**: tab di modulo, playground e creazione workflow.
- Canvas, libreria nodi/agenti/strumenti, configurazione nodi, collegamenti e output elaborato.
- Salvataggio, avvio, storico run, log, import/export e workflow schedulati.
- Coda degli interventi umani nella dashboard personale e run recenti nell'header.
- Configurazione applicativi collegabili personali, quando servono a canali workflow.

## Confini condivisi

- E il motore comune, non il proprietario di DDT, preventivi, report o archivio: quei moduli registrano nodi/workflow.
- Esegue agenti di [[agent_management]] e strumenti di [[document_intelligence]] solo se utente e workspace sono autorizzati.
- Le notifiche di revisione sono create tramite [[notification_center]], ma la decisione resta qui.

## Dipendenze attuali

- [[agent_management]]
- [[document_intelligence]]

## Moduli dipendenti

Nessuno.

## Revisione

- [ ] Mantieni
- [ ] Rendi indipendente dalla knowledge per i nodi generici
- [ ] Dividi motore e canvas

**Dipendenze desiderate:**

**Note:**
