# Scenari Di Produzione Del Database Birgus

## Obiettivo Del Documento
Questo documento descrive cosa e' realisticamente possibile fare in produzione con l'attuale database, cosa non e' ancora coperto, e perche'.

Il ragionamento parte dalla struttura attuale del sistema:
- multi-tenant basato su `workspaces`
- controllo accessi a livelli membership, moduli e permessi
- domini core (progetti, spedizioni, DDT, documenti)
- strato conversazionale (`assistant_*`) e knowledge base (`knowledge_*`)
- uso di `pgvector` per retrieval semantico

## Executive Summary
L'impianto e' adatto a una produzione SMB/PMI con requisiti forti di isolamento tenant, audit e processi documentali guidati da AI.

E' meno adatto, nello stato attuale, a:
- carichi enterprise ad altissima concorrenza
- processi OCR molto pesanti senza orchestrazione asincrona robusta
- collaboration nativa su chat tra utenti multipli
- analytics cross-tenant avanzata in tempo reale

## 1) Realta' Di Produzione Possibili (Cosa Si Puo Fare)

## 1.1 Multi-tenant reale con isolamento logico per workspace
Scenario:
- piu' aziende o reparti sullo stesso cluster DB
- ciascun utente opera nel proprio workspace

Cosa abilita:
- separazione dei dati per `workspace_id`
- selezione workspace per request
- membership utente-workspace con stato (`INVITED`, `ACTIVE`, `SUSPENDED`)

Perche' e' solido:
- il modello e' disegnato DB-first su workspace
- i repository applicativi filtrano per workspace
- l'accesso e' verificato anche lato middleware/tenancy guard

## 1.2 Modello RBAC + feature flags per tenant e utente
Scenario:
- workspace diversi con moduli attivi diversi
- utenti nello stesso workspace con abilitazioni differenti

Cosa abilita:
- attivazione/disattivazione modulo a livello workspace (`workspace_modules`)
- override specifico utente (`user_module_overrides`)
- permessi da ruoli (`roles`, `permissions`, `role_permissions`, `user_workspace_roles`)

Perche' e' utile in produzione:
- rollout graduali modulo per modulo
- governance del rischio su feature AI e automazioni
- gestione differenziata per admin/operator/viewer

## 1.3 Gestione ciclo vita documentale operativa
Scenario:
- caricamento file business, relazioni con progetto/spedizione/DDT
- archiviazione su object storage con metadati su DB

Cosa abilita:
- tracciamento metadati e ownership
- associazione documento a entita' dominio (`scope`, `domain_entity_type`, `domain_entity_id`)
- storico logico con soft delete

Valore produzione:
- compliance operativa (chi ha caricato cosa, quando)
- decoupling tra metadati relazionali e binario storage

## 1.4 Chatbot backend con audit e memoria persistente
Scenario:
- assistente interno che conversa su contesto progetto/spedizione/documento

Cosa abilita:
- sessioni chat con stato (`OPEN`, `CLOSED`, `ARCHIVED`)
- storico messaggi ordinato e persistente
- audit tool-call con input/output e stato (`REQUESTED`..`SUCCEEDED`/`DENIED`)
- snapshot memoria sintetica sessione

Valore produzione:
- tracciabilita' delle azioni AI
- riapribilita' informativa (lettura storico)
- base per troubleshooting e accountability

## 1.5 Knowledge base interrogabile (semantica e mirata)
Scenario:
- documenti indicizzati in chunk per supportare risposte del chatbot

Cosa abilita:
- ingestion in `knowledge_documents` + `knowledge_chunks`
- embeddings persistiti (`embedding_vector`)
- retrieval semantico su vettori
- retrieval mirato keyword/exact-match per verifiche puntuali

Valore produzione:
- risposta AI grounding su contenuto aziendale
- scelta strategica tra richiamo semantico e ricerca puntuale

## 1.6 Tracciamento processi asincroni business
Scenario:
- pipeline DDT e orchestrazione preventivi

Cosa abilita:
- stati job (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, ...)
- eventi e progress con payload
- osservabilita' applicativa su flussi lunghi

Valore produzione:
- diagnosi rapida dei colli di bottiglia
- reportabilita' di processo

## 2) Realta' Di Produzione Possibili Con Attenzioni Specifiche

## 2.1 Utente su piu' workspace
Si puo' fare:
- lo stesso `user_id` puo' avere piu' righe in `workspace_memberships`
- l'utente seleziona workspace attivo per request

Attenzioni:
- UX switch workspace chiara lato client
- evitare leakage logico tra contesti (prompt, cache, export)

## 2.2 Documenti grandi (es. PDF molto estesi)
Si puo' fare:
- ingest OCR e chunk persistente anche per documenti voluminosi

Attenzioni:
- tempi OCR e timeout applicativi
- crescita righe in `knowledge_chunks`
- necessita' di coda/job worker per ingestion massiva

## 2.3 Chat chiuse ma consultabili
Si puo' fare:
- `close` e' transizione di stato, non cancellazione
- storico resta disponibile per rilettura

Attenzioni:
- definire policy retention/archiviazione
- evitare crescita illimitata su tenant ad alto volume conversazionale

## 3) Limiti Attuali (Cosa Non Si Puo Fare O Non E' Completo)

## 3.1 Collaboration nativa su una stessa sessione chat
Non coperto nativamente:
- il modello corrente lega la sessione al creator (`opened_by_user_id`)
- non esiste ACL multi-utente per sessione

Conseguenza:
- non e' pronta una chat "team-shared" senza estensione schema/policy

## 3.2 Hard delete governato e data lifecycle avanzato
Parziale:
- molte tabelle usano `deleted_at` (soft delete)
- non emerge una policy completa di purge legale/operativa

Conseguenza:
- rischio accumulo dati e costi storage nel medio termine

## 3.3 Ricerca vettoriale ad altissima scala ottimizzata ANN
Parziale:
- il modello supporta `pgvector`
- manca evidenza di strategia ANN ottimizzata completa per altissimi volumi

Conseguenza:
- oltre una certa cardinalita' chunk, latenza e costi query possono crescere

## 3.4 Ingestion documentale massiva totalmente asincrona end-to-end
Parziale:
- l'architettura ha job su alcuni domini
- l'ingest knowledge puo' ancora essere percepita come operazione pesante lato request path

Conseguenza:
- per batch molto grandi serve pipeline dedicata con retry/backoff/dead-letter

## 3.5 Analytics cross-tenant enterprise e BI near-real-time
Non prioritaria nel disegno attuale:
- schema fortemente orientato a isolamento tenant e operativita'
- non emerge un layer dedicato a data warehouse/OLAP

Conseguenza:
- reporting strategico trasversale richiede estrazione e modello analitico separato

## 3.6 RLS database nativa (Row Level Security) come enforcement primario
Non evidente come policy primaria:
- l'isolamento e' oggi soprattutto applicativo (middleware + filtri query)

Conseguenza:
- per ambienti ad altissima compliance, puo' essere richiesto rafforzamento con RLS PG

## 4) Scenari Tipo In Produzione

## Scenario A: SaaS verticale per PMI logistica/editoria tecnica
Fattibilita': alta.

Perche':
- multi-tenant pragmatico
- moduli attivabili per cliente
- processi documentali + chat assistita con grounding

## Scenario B: Gruppo aziendale con reparti separati ma utenti trasversali
Fattibilita': alta con governance.

Perche':
- membership multi-workspace gia' compatibile
- serve solo una UX robusta di context switching e auditing.

## Scenario C: Contact center con migliaia di chat giornaliere e knowledge ingest continuo massivo
Fattibilita': media, con hardening.

Serve:
- code robuste per ingestion
- tuning indici/vector search
- policy aggressive di retention e archiviazione

## Scenario D: Settore regolato con requisiti forensi forti (audit immutabile, segregazione estrema)
Fattibilita': media-bassa nello stato attuale.

Serve:
- enforcement RLS nativo
- append-only audit dedicato
- chiara catena di custodia dati e policy di conservazione.

## 5) Decisioni Architetturali Consigliate Prima Del Go-Live Pieno

1. Definire SLO per OCR e ingestion knowledge.
2. Separare chiaramente i path sync vs async per documenti grandi.
3. Introdurre retention policy su chat, tool-calls, knowledge chunks.
4. Aggiungere monitoraggio su cardinalita' chunk, latency search, error budget.
5. Valutare RLS PostgreSQL se il profilo compliance lo richiede.
6. Disegnare eventualmente modello di chat condivisa (ACL session-level) se richiesta business.

## 6) Conclusione
Il database e' gia' una base solida per una produzione reale orientata a processi documentali e assistenza AI contestuale, con un buon livello di isolamento tenant e controllo accessi.

Il salto da "produzione funzionante" a "produzione enterprise ad altissima scala/compliance" richiede soprattutto:
- potenziamento dei flussi asincroni
- governance del lifecycle dati
- ottimizzazione retrieval su grandi volumi
- eventuale hardening di sicurezza lato DB nativo.
