---
key: agent_management
ui: Agenti
---
# agent_management

Catalogo degli agenti e dei prompt disponibili ai workflow. Non ha una pagina applicativa autonoma.

## Backend: blocchi funzionali

- Lettura, creazione e modifica di agenti di modulo (`ModuleAgent`).
- Sincronizzazione dei prompt standard distribuiti nel software.
- Catalogo prompt per DDT, preventivi, Measure Report e workflow generici.
- API `agents`; l'esecutore workflow verifica agente attivo, non eliminato e consentito.

## Dati posseduti

- `ModuleAgent`: chiave, nome, descrizione, prompt, configurazione e stato abilitato/eliminato.

## Frontend: blocchi visibili

- Scheda **Agenti** nell'editor Workflow, con nodi trascinabili consentiti.
- Configurazione di un nodo agente nel canvas.
- Nessuna pagina sidebar dedicata al catalogo agenti.

## Confini condivisi

- L'inferenza AI e condivisa con chat e workflow; qui vivono definizione e istruzioni dell'agente.
- Gli agenti vengono eseguiti da [[workflow_management]], non avviano processi in autonomia.
- Un prompt puo essere assegnato a un modulo operativo senza creare una dipendenza tecnica da quel modulo.

## Dipendenze attuali

Nessuna.

## Moduli dipendenti

- [[workflow_management]]

## Revisione

- [ ] Mantieni
- [x] Indipendente da [[project_management]]
- [ ] Dividi

**Dipendenze desiderate:**

**Note:**
