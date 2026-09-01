---
key: conversational_assistant
ui: Chatbot
---
# conversational_assistant

Assistente conversazionale del workspace con conversazioni persistenti, allegati, strumenti AI e uso facoltativo della knowledge.

## Backend: blocchi funzionali

- Creazione, elenco, ripresa e archiviazione delle sessioni chat.
- Messaggi utente/assistente, streaming, memoria sintetica e storico strumenti invocati.
- Allegati di sessione e recupero della knowledge quando scelto dall'utente.
- Registro e autorizzazione degli strumenti che il chatbot puo chiamare.
- Configurazione/diagnostica provider AI OpenAI-compatible e messaggi di errore provider.
- API `assistant` e impostazioni `ai-provider-settings`.

## Dati posseduti

- `AssistantSession`, `AssistantSessionDocument`, `AssistantMessage`.
- `AssistantToolCall`, `AssistantMemorySnapshot`.

## Frontend: blocchi visibili

- Assistente flottante, presente quando il modulo e abilitato.
- Conversazioni, streaming, allegati e scelta esplicita di usare la knowledge.
- Blocco **Provider AI** nelle Impostazioni Admin: provider, Base URL, modelli, verifica e diagnostica.

## Confini condivisi

- La knowledge viene letta da [[document_intelligence]], non duplicata nella chat.
- Il client AI e condivisibile con workflow/agenti; qui vive l'esperienza conversazionale, non il server vLLM.
- Avvio/arresto del runtime vLLM e di [[ai_runtime_control]].

## Dipendenze attuali

- [[document_intelligence]]

## Moduli dipendenti

Nessuno.

## Revisione

- [ ] Mantieni
- [ ] Rendi indipendente dalla knowledge
- [ ] Dividi

**Dipendenze desiderate:**

**Note:**
