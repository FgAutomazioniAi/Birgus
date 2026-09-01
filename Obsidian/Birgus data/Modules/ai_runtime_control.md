---
key: ai_runtime_control
ui: AI Runtime
---
# ai_runtime_control

Capability AI sempre presente nell'architettura. Gestisce il lifecycle del runtime locale vLLM quando esiste; il provider puo anche essere Brainyware o OpenAI-compatible esterno.

## Backend: blocchi funzionali

- Lettura dello stato del runtime locale vLLM, quando configurato.
- Comandi di avvio, arresto e diagnostica del container/runtime locale.
- API `settings/vllm-runtime`.

## Dati posseduti

- Nessuna tabella di dominio propria: usa configurazione applicativa e stato del servizio Docker.

## Frontend: blocchi visibili

- Blocco di controllo runtime AI nelle **Impostazioni Admin**: stato e comandi lifecycle.

## Confini condivisi

- Base URL, modello e provider sono di [[conversational_assistant]]; vLLM, Brainyware e API OpenAI sono alternative, non moduli alternativi.
- Non possiede agenti, workflow, knowledge o sessioni chat.
- Opera sul runtime esterno definito dall'installazione Docker.

## Dipendenze attuali

Nessuna dichiarata.

## Moduli dipendenti

Nessuno.

## Revisione

- [ ] Mantieni
- [ ] Rendi opzionale
- [ ] Altro

**Dipendenze desiderate:**

**Note:**
