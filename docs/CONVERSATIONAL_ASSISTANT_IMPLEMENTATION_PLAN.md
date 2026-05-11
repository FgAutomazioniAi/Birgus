# Conversational Assistant: lavori backend e frontend futuri

## Obiettivo
Predisporre Birgus a un assistente conversazionale multi-tenant che:
- mantenga memoria limitata alla sessione/ticket aperto;
- risponda usando funzioni applicative del backend, non accessi diretti al database;
- possa interrogare i documenti archiviati in Garage tramite un layer controllato di document intelligence;
- applichi permessi, tenant isolation e abilitazione moduli prima di ogni tool call;
- possa usare ricerca semantica sui contenuti testuali, senza sostituire la logica applicativa deterministica.

## Stato attuale del database
Le modifiche database gia applicate introducono questi pilastri:
- `assistant_sessions`
- `assistant_messages`
- `assistant_tool_calls`
- `assistant_memory_snapshots`
- `knowledge_documents`
- `knowledge_chunks`
- nuovi moduli `document_intelligence` e `conversational_assistant`
- nuovi permessi `knowledge.*` e `assistant.*`

Nota tecnica importante:
- il Postgres del progetto usa ora `pgvector` nello stesso database principale;
- la colonna reale `embedding_vector` vive in `knowledge_chunks`;
- la dimensione non e fissata a schema per lasciare spazio a modelli embedding diversi;
- gli indici ANN dedicati restano una fase successiva, da introdurre quando la strategia embedding verra stabilita in modo definitivo.

## Lavori backend da fare

### 1. Modulo domain `conversational-assistant`
Creare un modulo backend dedicato, coerente con la struttura OOP del progetto.

Cartelle target consigliate:
- `src/modules/conversational-assistant/domain`
- `src/modules/conversational-assistant/dto`
- `src/modules/conversational-assistant/repositories`
- `src/modules/conversational-assistant/infra`
- `src/modules/conversational-assistant/services`

Classi principali da introdurre:
- `AssistantSessionEntity`
- `AssistantMessageEntity`
- `AssistantToolCallEntity`
- `AssistantMemorySnapshotEntity`
- `AssistantSessionRepository`
- `PrismaAssistantSessionRepository`
- `AssistantSessionService`
- `AssistantRuntimeService`

Responsabilita:
- apertura/chiusura sessione;
- append dei messaggi;
- lettura cronologia;
- salvataggio risultati tool;
- aggiornamento `last_activity_at`;
- generazione e persistenza memory snapshot.

### 2. Modulo domain `document-intelligence`
Separare il layer documentale dal chatbot vero e proprio.

Cartelle target consigliate:
- `src/modules/document-intelligence/domain`
- `src/modules/document-intelligence/dto`
- `src/modules/document-intelligence/repositories`
- `src/modules/document-intelligence/infra`
- `src/modules/document-intelligence/services`

Classi principali:
- `KnowledgeDocumentEntity`
- `KnowledgeChunkEntity`
- `KnowledgeDocumentRepository`
- `PrismaKnowledgeDocumentRepository`
- `DocumentIntelligenceService`
- `DocumentExtractionService`
- `KnowledgeChunkingService`
- `EmbeddingIndexService`

Responsabilita:
- risolvere file da `documents`/Garage;
- leggere OCR o structured payload gia esistenti;
- lanciare analisi documentale on demand quando manca una rappresentazione utile;
- creare o aggiornare `knowledge_documents`;
- creare o aggiornare `knowledge_chunks`;
- gestire invalidazione quando il file sorgente cambia.

### 3. Registry dei tool consentiti
Il chatbot non deve costruire query SQL e non deve leggere Garage direttamente.

Serve introdurre un registro applicativo di tool backend, con classi dedicate.

Struttura consigliata:
- `src/modules/conversational-assistant/tools`
- `AssistantToolDefinition`
- `AssistantToolRegistry`
- `AssistantToolExecutor`

Esempi di tool iniziali:
- `get_project_summary`
- `list_project_versions`
- `get_project_version_shipment`
- `get_project_document`
- `get_project_quotation_context`
- `search_workspace_knowledge`
- `analyze_document_on_demand`

Regola fondamentale:
- ogni tool riceve `workspaceId`, `userId`, contesto sessione e parametri validati;
- il tool richiama servizi applicativi esistenti;
- i permessi vengono verificati nel codice prima di eseguire il tool;
- il prompt non decide i permessi.

### 4. Policy autorizzative per tool call
Serve un livello dedicato per autorizzare le funzioni invocabili dall'assistente.

Componenti consigliati:
- `AssistantToolPermissionService`
- `AssistantToolAccessPolicy`

Controlli minimi:
- membership workspace attiva;
- modulo `conversational_assistant` abilitato;
- modulo di dominio richiesto dal tool abilitato (`project_management`, `document_archive`, `ddt_processing`, ecc.);
- permesso utente coerente (`projects.read`, `documents.read`, `shipments.read`, ecc.);
- controllo di visibilita della singola entita.

### 5. Orchestrazione LLM con tool calling
Il runtime dell'assistente deve coordinare:
- cronologia sessione;
- memory snapshot;
- tool registry;
- eventuale retrieval documentale;
- chiamata modello;
- persistenza dei messaggi finali.

Classi consigliate:
- `AssistantConversationOrchestrator`
- `AssistantPromptComposer`
- `AssistantMemoryReducer`
- `AssistantToolCallingService`

Flusso consigliato:
1. ricezione messaggio utente;
2. caricamento sessione e ultimi messaggi;
3. caricamento ultimo snapshot memoria;
4. costruzione contesto minimo;
5. chiamata LLM con tool calling;
6. eventuale esecuzione tool autorizzati;
7. seconda chiamata LLM con risultati tool;
8. salvataggio risposta finale;
9. aggiornamento eventuale memory snapshot.

### 6. Supporto documentale per richieste su Garage
Per richieste come:
- “riportami informazioni riguardo il preventivo del progetto A, in particolare versione 1”

il backend dovra avere tool deterministici specializzati.

Esempio di flusso corretto:
1. tool backend risolve progetto e versione;
2. verifica modulo e permessi;
3. identifica il documento `quotation-pdf` o `quotation-docx` corretto;
4. verifica se esiste gia una rappresentazione in `knowledge_documents`;
5. se manca, esegue OCR/estrazione controllata;
6. restituisce solo il contesto utile al modello.

Tool consigliati:
- `get_project_version_quotation_context`
- `get_project_version_document_summary`
- `refresh_document_knowledge`

### 7. Riuso dei moduli Python e orchestrator esistenti
Il progetto ha gia un vantaggio forte:
- OCR condiviso via `python_modules`
- orchestrator Next gia usato da DDT e preventivi

Il lavoro futuro dovrebbe riusare questi blocchi.

Scelta consigliata:
- `DocumentIntelligenceService` decide quale pipeline usare;
- per PDF usa il modulo Python `ocr_engine`;
- per estrazioni strutturate richiama workflow orchestrator dedicati;
- per contenuti gia noti (es. DDT o quotation gia elaborati) prova prima a riusare i risultati persistiti.

### 8. Indicizzazione semantica
Il database supporta gia `pgvector`, quindi il lavoro backend dovra aggiungere:
- scrittura reale di `embedding_vector` in `knowledge_chunks`;
- indice ANN coerente con le dimensioni embedding scelte;
- job di reindicizzazione.

Servizi consigliati:
- `EmbeddingProviderClient`
- `KnowledgeEmbeddingService`
- `SemanticSearchService`

Fase iniziale consigliata:
- retrieval semantico solo su `knowledge_chunks`;
- nessuna interrogazione semantica diretta su tabelle operative come `projects` o `shipments`.

### 9. Worker asincroni
La document intelligence non dovrebbe essere tutta sincrona nelle richieste utente.

Lavori backend consigliati:
- introdurre job per OCR/refresh knowledge;
- introdurre job per generazione embedding;
- introdurre job per re-chunking se un file cambia.

Possibili componenti:
- `KnowledgeProcessingWorker`
- `EmbeddingWorker`
- coda interna analoga a quella usata per DDT.

### 10. API HTTP future
Rotte consigliate:
- `GET /api/assistant/sessions`
- `POST /api/assistant/sessions`
- `GET /api/assistant/sessions/:sessionId`
- `POST /api/assistant/sessions/:sessionId/messages`
- `POST /api/assistant/sessions/:sessionId/close`
- `GET /api/assistant/sessions/:sessionId/messages`
- `POST /api/knowledge/documents/:id/refresh`
- `GET /api/knowledge/search`

Tutte le rotte dovranno passare da:
- auth middleware
- module guard
- permission guard
- servizi di dominio

### 11. Audit e osservabilita
I dati gia previsti in `assistant_tool_calls` permettono audit fine-grained.

Da completare lato backend:
- logging tecnico delle tool call;
- collegamento con `audit_logs` per eventi rilevanti;
- metriche base:
  - tempo tool
  - tempo LLM
  - numero tool per sessione
  - numero chunk usati
  - errori autorizzativi

## Lavori frontend da fare

### 1. Nuovo modulo UI assistente
La UI dovrebbe vivere come modulo separato e governato da sidebar/moduli come il resto del progetto.

Route consigliata:
- `/assistente`

Pagina minima:
- elenco sessioni/ticket a sinistra;
- conversazione attiva al centro;
- pannello contesto a destra.

### 2. Lista sessioni/ticket
Funzionalita previste:
- aprire nuova sessione;
- vedere sessioni aperte/chiuse;
- filtrare per progetto, modulo, stato, data;
- riprendere una sessione esistente;
- chiudere una sessione.

Dati mostrabili:
- titolo sessione;
- stato;
- ultima attivita;
- contesto (progetto/versione/documento, se presente).

### 3. Thread conversazionale
Il pannello principale dovrebbe mostrare:
- messaggi utente;
- messaggi assistente;
- messaggi sistema/tool in forma compatta;
- stato generazione;
- eventuale tool in esecuzione.

Comportamenti consigliati:
- invio messaggio con textarea e submit;
- streaming futuro possibile, ma non obbligatorio nella prima iterazione;
- marcatura chiara quando una risposta usa dati documentali o funzioni backend.

### 4. Pannello contesto
Utile per ridurre ambiguita nella sessione.

Contenuti consigliati:
- progetto associato;
- versione associata;
- documento attivo;
- modulo di provenienza;
- ultimo aggiornamento memoria.

Questo permette all'utente di capire subito su quali dati sta lavorando l'assistente.

### 5. Integrazione con progetto/versione/documenti
La UX migliore non e solo una pagina chatbot isolata.

Ingressi contestuali consigliati:
- bottone “Chiedi all'assistente” nella scheda progetto;
- bottone nella vista versione progetto;
- bottone nella sezione documenti/preventivi;
- apertura sessione pre-contestualizzata con `project_id` / `project_version_id` / `document_id`.

### 6. Visualizzazione uso tool e fonti
Non serve mostrare tutto il debug, ma serve trasparenza operativa.

UI consigliata:
- micro badge tipo “ha consultato progetto”, “ha letto preventivo”, “ha cercato documenti”; 
- eventuale popup “Dettagli elaborazione” con tool usati e tempi;
- distinzione chiara tra risposta generativa e dati recuperati.

### 7. Stato modulo e permessi
Frontend da collegare a:
- `conversational_assistant`
- `document_intelligence`

Comportamento atteso:
- la voce sidebar compare solo se il modulo e abilitato;
- l'apertura di funzionalita documentali assistite dipende anche da `document_archive` e dai permessi dell'utente;
- la UI non deve mai simulare autorizzazioni: deve leggere l'esito API.

### 8. UX documentale
Per richieste centrate sui file, il frontend dovrebbe poter mostrare:
- documento sorgente usato nella risposta;
- versione progetto a cui appartiene;
- eventuale data ultima estrazione;
- stato knowledge (`READY`, `PROCESSING`, `ERROR`, `STALE`).

Questo e importante quando l'utente chiede qualcosa su un PDF presente in Garage e vuole capire se la risposta arriva da contenuti gia indicizzati o da nuova analisi.

### 9. Gestione errori
Stati da prevedere bene in UI:
- modulo disabilitato;
- permessi insufficienti;
- sessione scaduta;
- file non disponibile;
- knowledge non pronta;
- tool negato;
- errore modello.

Il comportamento atteso non e mostrare risposte ambigue, ma messaggi chiari e coerenti col resto del progetto.

## Sequenza di implementazione consigliata
1. Backend CRUD sessioni + messaggi.
2. Frontend base lista sessioni + thread.
3. Tool registry con primi tool deterministici su progetti/versioni/documenti.
4. `DocumentIntelligenceService` per rappresentazioni documentali persistite.
5. Integrazione delle richieste su Garage.
6. Memory snapshot automatici.
7. Indicizzazione embedding.
8. Ricerca semantica vera con `pgvector` e indici dedicati.

## Passo tecnico successivo per pgvector
Per passare da struttura pronta a retrieval performante, servira:
- scegliere provider e dimensioni embedding standard;
- scrivere il service di backfill embeddings;
- introdurre indice ANN coerente (`hnsw` o `ivfflat`, in base alla strategia scelta);
- aggiungere query raw/search repository dedicati.

## Principio architetturale da preservare
Il chatbot non deve sapere come interrogare il database.

Il principio da mantenere in tutto il lavoro futuro e:
- il modello decide quale funzione richiedere;
- il backend decide se la funzione e autorizzata;
- i servizi di dominio decidono come recuperare i dati;
- il layer documentale decide come leggere Garage/OCR/knowledge;
- il database resta la base dati, non il tool del modello.
