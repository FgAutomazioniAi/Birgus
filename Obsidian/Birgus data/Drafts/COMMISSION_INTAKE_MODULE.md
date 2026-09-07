---
label: Checklist raccolta dati
status: requirements-gathering
workflow: false
---

# Checklist raccolta dati

## Requisiti confermati

- Il modulo operativo si chiama **Checklist raccolta dati**.
- L'**Anagrafica commesse** e un modulo separato e di supporto: contiene i dati stabili della commessa.
- Non usa workflow.
- E un modulo a step, con pagine numerate in alto e indicazione del progresso.
- Serve a raccogliere dati partendo da una commessa gia presente in anagrafica.
- La checklist mostra una lista operativa con commessa, cliente e descrizione progetto; aprendo una riga tramite azione esplicita si entra nel form.
- I dati possono arrivare anche da una piattaforma esterna; campi e API non sono ancora disponibili.
- Deve gestire testo breve, descrizione con area testo, obbligatorieta, selettore, checkbox e tabelle.
- Deve avere una firma di presa visione che salva il nome dell'utente autenticato.
- In caso di modifica contemporanea bisogna fermare la risorsa per evitare incongruenze.
- Deve esistere un backlog che indichi chi ha modificato cosa.
- I permessi previsti sono visualizzatore e modificatore.
- Il form progressivo e vincolato da 16 tabelle di database, la cui struttura non e ancora definita.

## Notazione ricevuta

| Notazione | Significato dichiarato |
| --- | --- |
| `c1`, `c2`, ... | Pagina del modulo, numerata nel progresso. |
| `txt (placeholder)` | Input con placeholder. |
| `desc` | Titolino e text area. |
| `_` ... `_` | Campo sulla stessa riga. |
| `sel` | Selettore. |
| `[]` | Checkbox. |
| `tab` | Formato tabellare con colonne; anche vista lista tabellare. necessario usare struttura tabellare universale presente nel progetto. Vorrei poter aggiungere
o rimuovere una riga a tabella a piacimento. |
| `/` | Fine pagina (unico carattere nella riga)
| `|` | a capo ma stesso "blocco"
| `num` | sottotitolo numerato
| `#` | commento per istruzioni o note per la stesura file
| Firma finale | Salva il nome del firmatario che ha preso visione. |

## Informazioni mancanti prima di progettare il database

- Elenco effettivo delle 16 tabelle richieste, con nome e finalita di ciascuna.
- Elenco delle pagine e dei campi della prima checklist.
- Colonne delle tabelle visibili nel form e tipologia di ogni colonna.
- Dati necessari per completare l'anagrafica commesse e regole di collegamento ai clienti.
- Regole esatte di blocco durante la modifica contemporanea.
- Contenuto richiesto nel backlog e nella firma.
- Permessi e soggetti autorizzati ad assegnare visualizzatore/modificatore.
- Specifiche della piattaforma da importare.

## Sezioni form ricevute

Queste voci sono trattate come pagine/sezioni iniziali del template principale. Ogni sezione potra contenere campi semplici, blocchi descrittivi, selettori, checkbox, tabelle e allegati.

1. Informazioni generali progetto
2. Processo produttivo attuale
3. Prodotto/componente da lavorare
4. Obiettivi e requisiti automazione
5. Spazio e layout disponibile
6. Utilities e infrastrutture
7. Controllo, supervisione e integrazione IT
8. Visione artificiale e intelligenza artificiale
9. Robotica e manipolazione
10. Sicurezza e normative
11. Manutenzione e assistenza
12. Collaudo e validazione
13. Tempi e budget
14. Documentazione e allegati
15. Cybersecurity OT - conformita NIS2 (Dir. UE 2022/2555)
16. Note e osservazioni

## Vincolo di progettazione aggiornato

I nomi delle sezioni permettono di definire la struttura logica del database. Il contenuto puntuale di campi, colonne tabellari, obbligatorieta e regole resta da definire man mano.

## Struttura logica proposta

Questa struttura descrive il modello prima della migrazione effettiva. L'obiettivo e separare cio che definisce il form da cio che l'utente compila, mantenendo versioni, permessi e storico modifiche.

### Livello modulo

- `commission_registry`: modulo workspace-scoped per anagrafica commesse.
- `commission_intake`: modulo workspace-scoped per Checklist raccolta dati.
- Non dipende da workflow.
- `commission_intake` dipende da `commission_registry`, perche la checklist deve partire da una commessa sorgente.
- Puo collegarsi a `project_management`, ma non deve dipendere da questo per esistere.
- Puo allegare documenti tramite `document_archive`, se il workspace ha l'archivio attivo.

### Livello definizione form

- Template: rappresenta un tipo di raccolta dati, per esempio una checklist commessa.
- Versione template: fotografia immutabile pubblicata del template.
- Pagina: corrisponde a `c1`, `c2`, `c3`, con ordine e titolo.
- Sezione: blocco logico dentro una pagina, utile per raggruppare campi senza obbligare il frontend a conoscere il JSON.
- Campo: singolo input del form, con tipo, etichetta, placeholder, obbligatorieta e regole.
- Opzione: valori disponibili per un campo `sel`.
- Tabella definita: campo tabellare con colonne, tipi e regole.

### Livello compilazione

- Record: istanza compilata da un utente o importata da piattaforma esterna.
- Valore campo: valore atomico collegato a record, versione template e campo.
- Riga tabellare: riga di una tabella compilata.
- Cella tabellare: valore di una singola colonna dentro una riga.
- Stato record: bozza, in lavorazione, pronto per firma, firmato, archiviato.
- Revisione record: numero progressivo per impedire salvataggi su dati vecchi.

### Livello accesso

- Permesso modulo: decide se il modulo e visibile nel workspace.
- Permesso operativo: decide se l'utente puo leggere, modificare o configurare i template.
- Accesso record: assegna `VIEWER` o `EDITOR` a utenti specifici sul singolo record.
- Regola consigliata: admin e superadmin del workspace possono gestire tutto; utenti operativi vedono solo record assegnati o creati da loro, salvo policy diversa.

### Livello blocco modifica

- Lock record: impedisce a due utenti di modificare contemporaneamente la stessa risorsa.
- Il lock deve avere proprietario, token opaco, scadenza e heartbeat.
- Se un utente apre un record gia bloccato, puo visualizzarlo ma non modificarlo.
- Se il lock scade, un altro editor puo acquisirlo.
- Ogni salvataggio deve controllare token lock e `revision_no`.

### Livello audit/backlog

- Evento record: storico leggibile delle modifiche.
- Deve contenere utente, data, azione, pagina/campo coinvolto, valore precedente e nuovo valore quando non sensibile.
- Per dati sensibili si salva un riassunto redatto, non il valore completo.
- Gli eventi di dominio possono anche alimentare `AuditLog` globale, ma non devono sostituirlo.

### Livello import

- Sorgente import: piattaforma esterna collegata.
- Mapping import: regole che associano campi esterni ai campi del template.
- Run import: esecuzione di import, con esito, conteggi, errori e record creati/aggiornati.
- I segreti della piattaforma non devono stare nei log ne nei mapping leggibili.

### Livello firma

- Firma: presa visione dell'utente autenticato sul record.
- Deve salvare user id, nome visualizzato al momento della firma, data, versione template e revisione firmata.
- La firma non deve essere trattata come firma legale, salvo scelta futura esplicita.

## Tabelle logiche candidate

1. `commission_form_templates`
2. `commission_form_versions`
3. `commission_form_pages`
4. `commission_form_sections`
5. `commission_form_fields`
6. `commission_field_options`
7. `commission_table_definitions`
8. `commission_table_columns`
9. `commission_records`
10. `commission_record_values`
11. `commission_record_table_rows`
12. `commission_record_table_cells`
13. `commission_record_access`
14. `commission_record_locks`
15. `commission_record_events`
16. `commission_record_signatures`
17. `commission_import_sources`
18. `commission_import_mappings`
19. `commission_import_runs`

## Canvas

- [[COMMISSION_INTAKE_DATABASE.canvas|Canvas database raccolta commesse]]
- [[COMMISSION_INTAKE_DATABASE_SCHEMA|Schema database raccolta commesse]]
- [[COMMISSION_INTAKE_DATABASE_SCHEMA.canvas|Canvas schema database raccolta commesse]]

## Regola per i nomi dei form che verranno forniti

Quando arriva l'elenco dei form, ogni voce va classificata in uno di questi livelli:

- Template, se rappresenta un tipo di raccolta dati riutilizzabile.
- Pagina, se rappresenta uno step `cN`.
- Sezione, se rappresenta un blocco visivo o concettuale dentro una pagina.
- Campo, se rappresenta un dato singolo da compilare.
- Tabella, se rappresenta una lista di righe con colonne.
- Entita esterna, se rappresenta un dato importato o collegato a una piattaforma terza.
- Anagrafica, se deve diventare un oggetto stabile riusabile da piu record.

## Decisioni da prendere mentre arrivano i form

- Quali dati sono solo campi della checklist e quali meritano una tabella/anagrafica propria.
- Quali campi devono essere ricercabili o filtrabili nella lista record.
- Quali campi devono essere obbligatori per avanzare di pagina.
- Quali campi vengono importati e quali restano manuali.
- Quali dati devono entrare in archivio documentale o knowledge.
- Quali dati devono essere redatti nei log.
