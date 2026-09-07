INFORMAZIONI GENERALI PROGETTO
_ txt (Nr. Commessa) | txt (Cliente) _
_ txt (Descrizione progetto) | txt (Tecnico / Produzione cliente) _
_ txt (Data Sopralluogo) | txt (Stabilimento / Plant) _
_ txt (Reparto / Linea produttiva) | txt (Referente FG Automazioni) _
/

PROCESSO PRODUTTIVO ATTUALE
num 2.1 Descrizione Generale
desc Descrizione dettagliata del processo attuale 
num 2.2 Fasi del Processo
tab
col1 N #indica un numero
col2 txt(Fase)
col3 sel (Manuale, auto)
col4 txt(Tempo ciclo)
/tab
num 2.3 Dati Operativi Attuali
[] Cadenza produttiva attuale (pz/h, pz/turno): txt()
[] Numero turni lavoro: _ []1 turno  []2 turni  []3 turni []Continuo _
[] Numero operatori coinvolti nel processo : txt()
[] OEE attuale (se disponibile): txt()%
[] Tempo di setup / cambio formato: txt()
[] Tasso di scarto attuale: txt()%
[] Principali cause di fermo: txt()
[] MTBF (Mean Time Between Failures): txt()
[] MTTR (Mean Time To Repair): txt()
/

PRODOTTO/COMPONENTE DA LAVORARE
num 3.1 Caratteristiche fisiche
_
txt(Tipologia prodotto)
txt(Materiale)
_
_
txt(Dimensioni (L x P x H mm))
txt(Peso (Kg))
_
_
txt(Forma geometrica)
txt(Tolleranze dimensionali)
_
_
txt(Finitura superficiale richiesta)
txt(Temperatura di processo (se applicabile))
_
txt(Fragilità / Delicatezza)
num 3.2 Varianti e Formati
tab
col1 Codice/SKU
col2 Dimensioni
col3 Peso
col4 % Produzione
num 3.3 Specifiche Qualitative
[] Parametri critici da controllare: txt()
[] Tolleranze qualitative: txt()
[] Controlli qualità richiesti: _ [] Visivo [] Dimensionale [] Funzionale [] Altro: txt()_
[] Normative di riferimento (es. ISO, CE, FDA): txt() 
[] Tracciabilità richiesta: _ []Lotto []Seriale []Non necessaria _   
[] Campionamento: ogni txt() pezzi
/

OBIETTIVI E REQUISITI AUTOMAZIONE
num 4.1 Obiettivi Produttivi
[] Cadenza produttiva target (pz/h): txt()
[] Volume produttivo annuo previsto: txt()
[] Incremento produttività desiderato: txt() %
[] Riduzione scarti target: txt() %
[] OEE target: txt() %
[] Tempo di ciclo massimo accettabile: txt()
num 4.2 Operazioni da Automatizzare - indicare le operazioni da automatizzare in ordine di priorità:
_ [] Alimentazione / Carico materiale | Priorità [] Alta [] Media [] Bassa _
_ [] Prelievo / Manipolazione | Priorità [] Alta [] Media [] Bassa _
_ [] Posizionamento / Orientamento | Priorità [] Alta [] Media [] Bassa _
_ [] Assemblaggio componenti | Priorità [] Alta [] Media [] Bassa _
_ [] Lavorazione meccanica | Priorità [] Alta [] Media [] Bassa _
_ [] Saldatura / Incollaggio | Priorità [] Alta [] Media [] Bassa _
_ [] Controllo qualità visivo | Priorità [] Alta [] Media [] Bassa _
_ [] Controllo dimensionale | Priorità [] Alta [] Media [] Bassa _
_ [] Marcatura / etichettatura | Priorità [] Alta [] Media [] Bassa _
_ [] Imballaggio / confezionamento | Priorità [] Alta [] Media [] Bassa _
_ [] Palletizzazione | Priorità [] Alta [] Media [] Bassa _
_ [] Scarico / Evacuazione | Priorità [] Alta [] Media [] Bassa _
_ [] Altro: txt() | Priorità [] Alta [] Media [] Bassa _ # possibilità di aggiungerne ulteriori
num 4.3 Livello di Automazione Richiesto
[] Automazione parziale (isole automatizzate + operatori)
[] Automazione completa della linea
[] Sistema semi-automatico (assistenza operatore)
[] Collaborativo (cobot + operatore)
_
[] Flessibilità richiesta: 
[] Mono-prodotto [] Multi-formato [] Multi-prodotto 
_
/
SPAZIO E LAYOUT DISPONIBILE
5.1 Dimensioni Area
[] Spazio disponibile (L x P x H metri) txt()
[] Planimetria allegata []Sì []No
[] Foto area disponibili []Sì []No
[] Vincoli dimensionali: txt()
[] Altezza utile disponibile: txt() metri
[] Portata pavimento: txt() kg/m2
[] Accessi/Vie di fuga da mantenere: txt()
num 5.2 Integrazione con Linea Esistente
[] Sistema standalone: []Sì []No
[] Integrazione con macchine esistenti: []Sì []No
[] Macchine a monte: txt()
[] Macchine a valle: txt()
_
[] Sistema di trasporto esistente: []Nastri []Rulli []Catene []AGV []Altro: txt()
_
[] Altezza piano di lavoro esistente: txt(valore approssimato) mm
UTILITIES E INFRASTRUTTURE
num 6.1 Alimentazione Elettrica
[] Tensione disponibile: [] 230V 1F []400V 3F [] Altra: txt()
[] Potenza disponibile: txt() kW
[] Posizione quadro elettrico principale: txt()
[] Distanza dalla macchina: txt() metri
[] Sistema di messa a terra: [] Presente [] Da verificare
[] UPS / Gruppo di continuità: [] Presente [] Richiesto [] Non necessario
num 6.2 Aria compressa
[] Aria compressa disponibile []Sì []No
[] Pressione disponibile: txt() bar
[] Portata disponibile: txt() Nl/min
[] Qualità aria (ISO 8573-1): Classe solidi: txt() Acqua:txt() Olio:txt()
[] Punto di rugiada: txt() C°
[] Distanza punto di ripresa: txt() metri
num 6.3 Altre utilities
[] Acqua industriale: Pressione: txt() bar
[] Vuoto: Livello: txt() mbar
[] Gas speciali: specificare: txt()
[] Aria condizionata, Temperatura: [] - [] °C, Umidità [] - [] %
[] Illuminazione area: [] Adeguata [] Da integrare Lux: txt()
[] Aspirazione fumi/polveri: [] Presente [] Richiesta
CONTROLLO,SUPERVISIONE E INTEGRAZIONE IT
num 7.1 Sistema di Controllo
[] PLC esistente in plant: [] Siemens [] Allen-Bradley [] Omron [] Altro: txt() Quantità: txt()
[] Standard richiesto: txt()
[] HMI richiesto: [] Touch panel locale [] PC industriale []Entrambi [] Quantità txt()
[] Dimensione HMI preferita: []7" []10" []15" []21" []Altra:txt()"
[] Lingua interfaccia: []Italiana []Inglese []Tedesca []Multilingua
[] Livelli utente richiesti: [] Operatore [] Manutentore [] Manager [] Sviluppatore | [] Altro: txt()
num 7.2 Connettività e Integrazione
[] Rete aziendale disponibile: []Sì []No
[] Tipo rete: [] Ethernet [] Profinet [] EtherCAT [] Altro: txt()
[] Indirizzo IP richiesto: txt()
[] VPN per assistenza remota
[] Firewall / Restrizioni di rete presenti. Dettagli: txt()
num 7.3 Sistemi Gestionali (MES / ERP)
[] MES / ERP presente. Dettagli: txt()
[] Integrazione richiesta: []Sì []No
[] Protocollo comunicazione: []OPC UA []OPC DA []MQTT []REST API []Altro: txt()
[] Dati da scambiare: []Produzione []Allarmi []Qualità []Tracciabilità []Altro: txt()
[] Database produzione
[] Report automatici

num 7.4 Industria 4.0 e Digital Twin
[] Requisiti Industria 4.0 per incentivi: []Si []No
[] Interconnessione richiesta: []Si []No
[] Monitoraggio remoto: []Richiesto []Non necessario
[] Predictive maintenance: []Richiesta []Non necessaria
[] Digital Twin: []Richiesto []Non necessario
[] Dashboard real-time: []Richiesta []Non necessaria
/

VISIONE ARTIFICIALE E INTELLIGENZA ARTIFICIALE
num 8.1 Controllo Visivo
[] Controllo qualita visivo richiesto: []Si []No
[] Difetti da rilevare: txt()
[] Dimensione minima difetto: txt() mm
[] Contrasto difetto/sfondo: []Alto []Medio []Basso
[] Superfici da ispezionare: []Piane []Curve []3D complesse
[] Velocita ispezione: txt() pz/min
[] Illuminazione critica: []Si []No
num 8.2 Posizionamento/Riconoscimento
[] Visione per posizionamento: []Richiesta []Non necessaria
[] Tipo riconoscimento: []Pattern matching []Blob analysis []OCR []Codici 1D/2D
[] Telecamera: []Global Shutter []Rolling Shutter []Line Scan []Altro: txt()
[] Quantita: txt()
[] Precisione posizionamento richiesta: +/- txt() mm
[] Campo visivo (FOV): txt() x txt() mm
[] Distanza di lavoro: txt() mm
[] Tempo ciclo visione: txt() ms
num 8.3 AI e Deep Learning
[] AI per ispezione: []Richiesta []Non necessaria
[] Casistiche complesse/variabili: []Si []No
[] Dataset immagini disponibili: []Si, quantita: txt() []No
[] Training necessario: []Si []No
[] Classificazione difetti: []Richiesta []Non necessaria
[] Self-learning: []Richiesto []Non necessario
num 8.4 Conformita AI Act (Reg. UE 2024/1689)
[] Classificazione del sistema AI: []Rischio minimo []Rischio limitato []Rischio alto (componente di sicurezza ex All. I) []Da valutare
[] Il sistema AI partecipa a funzioni di sicurezza macchina: []Si []No, solo qualita/produzione
[] Alfabetizzazione AI del personale Cliente garantita (Art. 4 AI Act): []Si []Da pianificare
[] Servizio richiesto a FG Automazioni: txt()
[] Documentazione tecnica AI (dataset, metriche, drift): []Standard []Estesa, richiesta dal Cliente
[] Sorveglianza umana e gestione drift modello (Human Oversight): []Operatore conferma esiti []Audit periodici []Automatica con allarme
/

ROBOTICA E MANIPOLAZIONE
num 9.1 Manipolazione Robotizzata
[] Robot richiesto: []Si []No []Si, quantita: txt()
[] Tipologia: []Antropomorfo []SCARA []Delta []Cartesiano []Cobot
[] Payload richiesto: txt() kg
[] Raggio di lavoro: txt() mm
[] Numero assi: []4 []6 []Altro: txt()
[] Precisione ripetibilita: +/- txt() mm
[] Velocita movimento: []Standard []Alta velocita
[] Ambiente: []Standard []Cleanroom []ATEX []Alimentare
num 9.2 Prese e End-Effector
[] Tipologia presa: []Ventosa []Pinza meccanica []Pinza magnetica []Altro: txt()
[] Numero punti di presa simultanei: txt()
[] Forza presa richiesta: txt() N
[] Cambio utensile automatico: []Richiesto []Non necessario
[] Sensori su gripper: []Forza/Coppia []Presenza pezzo []Altro: txt()
num 9.3 Movimentazione Materiali
[] Sistema trasporto: []Nastri []Rulli []Catene []Slat []Altro: txt()
[] Velocita trasporto: txt() m/min
[] Larghezza nastro: txt() mm
[] Passo prodotti sul nastro: txt() mm
[] Accumulo buffer: []Richiesto []Non necessario []Capacita: txt() pz
[] AGV/AMR: []Richiesto []Non necessario
num 9.4 Vendor List componenti (standard FG Automazioni)
# Elenco fornitori/marche di riferimento proposti da FG Automazioni per la progettazione.
# Salvo diversa indicazione del Cliente, i componenti saranno selezionati tra le marche elencate.
# La struttura, categorie e marche, e mantenuta da FG Automazioni.
tab
col1 Categoria
col2 Componente
col3 Marche di riferimento
col4 Confermato
col5 Altro
row Componenti di sicurezza | Barriere fotoelettriche di sicurezza | REER, KEYENCE, SICK, OMRON, PILZ; con relativo modulo di controllo, se necessario | [] | txt()
row Componenti di sicurezza | Laser scanner di sicurezza | REER, KEYENCE, SICK, OMRON, PILZ | [] | txt()
row Componenti di sicurezza | Finecorsa elettromeccanici e RFID di sicurezza | PIZZATO, SCHMERSAL, SIEMENS, SCHNEIDER | [] | txt()
row Componenti di sicurezza | Pulsantiere bimanuali | SCHNEIDER | [] | txt()
row Componenti di sicurezza | Moduli di sicurezza | SIEMENS, PILZ, SCHNEIDER | [] | txt()
row Componenti di sicurezza | PLC di sicurezza | SIEMENS S7-1200, S7-1500 | [] | txt()
row Componenti di sicurezza | Pulsanti di emergenza | SIEMENS diametro 22 mm con contatti aventi controllo montaggio | [] | txt()
row Sensoristica | Sensori fotoelettrici / fotocellule | OMRON, KEYENCE; preferibile tipo a sbarramento salvo esigenze particolari | [] | txt()
row Sensoristica | Fibre ottiche | OMRON, KEYENCE | [] | txt()
row Sensoristica | Fotocellule a forcella | BALLUFF | [] | txt()
row Sensoristica | Sensori induttivi e capacitivi | CONTRINEX, BALLUFF, AECO | [] | txt()
row Sensoristica | Sensori/finecorsa su cilindri e slitte | Prodotti specifici del fornitore attuatori, SMC, FESTO | [] | txt()
row Sensoristica | Microinterruttori e finecorsa elettromeccanici | SIEMENS, OMRON, PIZZATO | [] | txt()
row Materiali per strutture | Profilati in alluminio per strutture | BOSCH, ALUTEC | [] | txt()
row Pneumatica e manipolazione | Gruppi trattamento aria, avviatori progressivi, valvole, cilindri, slitte, accessori vari | SMC, FESTO | [] | txt()
row Pneumatica e manipolazione | Pinze | SMC, FESTO, SCHUNK, ZIMMER | [] | txt()
row Pneumatica e manipolazione | Pick and place | FESTO | [] | txt()
row Pneumatica e manipolazione | Sistemi di cambio rapido | SCHUNK, ZIMMER | [] | txt()
row Pneumatica e manipolazione | Sistemi generazione vuoto ed eiettori | SMC, FESTO, SCHMALZ | [] | txt()
row Nastri trasportatori | Nastri trasportatori | ALUTEC | [] | txt()
row Tavole rotanti e sistemi index | Tavole rotanti e sistemi index | WEISS, ITALPLANT, BETTINELLI | [] | txt()
row Sistemi di comando, controllo e misura | PLC | SIEMENS serie 1200-1500 | [] | txt()
row Sistemi di comando, controllo e misura | CNC | SIEMENS | [] | txt()
row Sistemi di comando, controllo e misura | HMI | SIEMENS | [] | txt()
row Sistemi di comando, controllo e misura | Motion | SIEMENS | [] | txt()
row Sistemi di comando, controllo e misura | Misura | NATIONAL INSTRUMENTS | [] | txt()
row Robot | Robot antropomorfi | KUKA | [] | txt()
row Robot | Robot SCARA | KUKA | [] | txt()
row Robot | Robot collaborativi | KUKA | [] | txt()
row AGV e AMR | Payload <= 100 kg | KUKA | [] | txt()
row AGV e AMR | Payload > 100 kg | KUKA | [] | txt()
row Marcatura, tampografia ed etichettatura | Marcatura laser | KEYENCE, LASIT, EVLASER | [] | txt()
row Marcatura, tampografia ed etichettatura | Tampografia | COMEC, TAMPOPRINT | [] | txt()
row Marcatura, tampografia ed etichettatura | Etichettatrici | 2 EMME, RETEL, CAB | [] | txt()
row Sistemi di visione e lettori | Sistemi di visione | VISIOFY, COGNEX, KEYENCE | [] | txt()
row Sistemi di visione e lettori | Sensori di visione | IMAGES, COGNEX, KEYENCE | [] | txt()
row Sistemi di visione e lettori | Lettori barcode / QR code | IMAGES, COGNEX, KEYENCE, DATALOGIC | [] | txt()
/tab
# I dispositivi che necessitano di periodica taratura o controllo metrologico dovranno essere facilmente accessibili con macchina in funzione e in totale sicurezza per il verificatore.
/

SICUREZZA E NORMATIVE
num 10.1 Dispositivi di Sicurezza
[] Categoria sicurezza richiesta: []Cat. 3 []Cat. 4 []PLd []PLe
[] Recinzioni/Barriere: []Richieste []Non necessarie
[] Barriere ottiche: []Richieste []Non necessarie
[] Scanner laser sicurezza: []Richiesti []Non necessari
[] Tappeti/Bordi sensibili: []Richiesti []Non necessari
[] Arresto emergenza: []A fungo []A fune []Entrambi
[] Blocco porte: []Con interblocco []Con ritardo
[] Segnalazioni luminose: []Torretta []Lampeggianti []Entrambi
num 10.2 Normative e Certificazioni
[] Marcatura CE: []Richiesta, obbligatoria
[] Direttiva Macchine 2006/42/CE: []Applicabile
[] Normative specifiche settore: txt()
[] ATEX, ambienti esplosivi: []Richiesto []Non necessario
[] Alimentare, FDA/HACCP: []Richiesto []Non necessario
[] Farmaceutico, GMP: []Richiesto []Non necessario
[] Analisi rischio, ISO 12100: []Richiesta
[] Valutazione rumore: []Richiesta []Limite: txt() dB(A)
num 10.3 Ergonomia e Operatore
[] Interazione operatore-macchina: []Frequente []Occasionale []Rara
[] Altezza piano di lavoro ergonomica: []Richiesta
[] Accessi per manutenzione: []Prioritari
[] Piattaforme elevatrici: []Necessarie []Non necessarie
[] Scarichi ergonomici: []Richiesti
/

MANUTENZIONE E ASSISTENZA
num 11.1 Requisiti Manutenzione
[] Accessibilita componenti: []Frontale []Laterale []Dall'alto
[] Modularita richiesta: []Si []No
[] Quick-change componenti: []Richiesto []Non necessario
[] Lubrificazione: []Automatica []Manuale []Componenti pre-lubrificati
[] Filtri aria/olio: []Standard []Easy access
[] Diagnostica avanzata: []Richiesta []Non necessaria
num 11.2 Personale Manutentivo
[] Competenze interne: []Meccaniche []Elettriche []Software []Nessuna
[] Training richiesto: []Operatori []Manutentori []Tecnici
[] Lingua formazione: []Italiano []Inglese
[] Manuali richiesti: []Cartacei []Digitali []Video
[] Ricambi scorta: []Lista consigliata []Kit di avvio
num 11.3 Assistenza Post-Vendita
[] Contratto assistenza: []Richiesto []Da valutare []Non necessario
[] Tempo intervento richiesto: []8h []24h []48h
[] Assistenza remota: []Richiesta []Non necessaria
[] Hotline telefonica: []8-18 []H24 []Non necessaria
[] SLA (Service Level Agreement): []Richiesto []Uptime garantito: txt() %
/

COLLAUDO E VALIDAZIONE
num 12.1 FAT (Factory Acceptance Test)
[] FAT richiesto presso costruttore: []Si []No
[] Partecipanti FAT: []Cliente []End user []Ente certificazione
[] Test da eseguire: txt()
[] Documentazione FAT: []Richiesta
[] Materiale cliente per test: []Fornito da cliente []Fornito da costruttore
num 12.2 SAT (Site Acceptance Test)
[] SAT richiesto: []Si []No
[] Durata collaudo in sito: txt() giorni
[] Produzione campioni: quantita minima: txt() pz
[] Parametri KPI da raggiungere: txt()
[] Periodo garanzia: []12 mesi []24 mesi []Altro: txt()
[] Run&Rate test: []Richiesto []Durata: txt() ore/giorni
num 12.3 Validazione IQ/OQ/PQ
[] Validazione richiesta (Pharma/Food): []Si []No
[] IQ (Installation Qualification): []Richiesta
[] OQ (Operational Qualification): []Richiesta
[] PQ (Performance Qualification): []Richiesta
[] Protocolli validazione: []Da costruttore []Da cliente
[] Supporto validazione: []Richiesto []Solo documentazione
# IQ verifica che l'apparecchiatura sia installata correttamente e conforme alle specifiche del produttore.
# OQ convalida che la macchina funzioni correttamente nelle condizioni operative previste.
# PQ conferma che il sistema produca risultati costanti e riproducibili nel processo reale.
/

TEMPI E BUDGET
num 13.1 Timeline Progetto
[] Data target installazione: txt()
[] Data avvio produzione: txt()
[] Finestre disponibili per installazione: txt()
[] Fermo produzione programmato: dal txt() al txt()
[] Milestone intermedie critiche: txt()
num 13.2 Budget e Investimento
[] Budget disponibile: []<100K []100-250K []250-500K []>500K
[] Investimento approvato: []Si []In approvazione []Da definire
[] ROI target: txt() mesi
[] Payback period accettabile: txt() mesi
[] Opzioni finanziamento: []Acquisto []Leasing []Noleggio
[] Incentivi 4.0/Transizione 5.0: []Da sfruttare []Non applicabile
/

DOCUMENTAZIONE E ALLEGATI
# Documentazione da allegare alla checklist.
[] Planimetria stabilimento, scala e quotata
[] Layout area di installazione
[] Fotografie area
[] Scheda tecnica prodotto/componente
[] Disegni tecnici 2D/3D prodotto
[] Campioni fisici prodotto, se disponibili
[] Specifiche qualita e tolleranze
[] Ciclo di lavoro attuale, flow chart
[] Dati produttivi storici
[] Report analisi criticità
[] Video processo attuale
[] Schemi elettrici area
[] Documentazione macchine esistenti da integrare
[] Standard aziendali, PLC, HMI, sicurezza
[] Normative specifiche applicabili
[] Policy aziendali cybersecurity Cliente, NIS2, accessi, gestione incidenti
[] Schema rete OT, lista asset PLC/HMI/switch e regole firewall esistenti
[] Registro modelli AI esistenti del Cliente, in caso di interconnessione/riuso
/

NOTE E OSSERVAZIONI
desc Annotazioni, criticità evidenziate, richieste particolari
/

CYBERSECURITY OT - CONFORMITA' NIS2 (Dir. UE 2022/2555)
# Sezione da compilare in coordinamento con il referente IT/OT Security del Cliente.
# Le informazioni sono trattate come dati riservati e utilizzate esclusivamente ai fini della progettazione e della valutazione dei requisiti di sicurezza dell'impianto.
num 16.1 Inquadramento del Cliente rispetto a NIS2
[] Il Cliente rientra nell'ambito NIS2: []Soggetto essenziale []Soggetto importante []Non rientra []Da verificare
[] Settore di appartenenza (All. I/II Dir. UE 2022/2555): txt()
[] Registrazione presso ACN effettuata: []Si []No []Non applicabile
[] Referente Cybersecurity Cliente (nome/ruolo): txt()
[] Politiche/standard interni applicati: []ISO/IEC 27001 []IEC 62443 []NIST CSF []Altro: txt()
num 16.2 Architettura di rete OT
[] Segregazione rete OT/IT: []VLAN dedicata []Firewall industriale []DMZ []Rete piatta, assente
[] Architettura di riferimento (Purdue Model): []Adottata []Parziale []Non adottata
[] VLAN/subnet assegnata alla nuova macchina: txt()
[] Regole firewall richieste (porte/protocolli ingresso/uscita): txt()
[] Wireless ammesso in area OT: []Si []No []Solo per manutenzione []Standard: txt()
[] Suddivisione in zone e conduit (IEC 62443-3-2): []Definite dal Cliente []Da definire con FG Automazioni []Non applicato
[] Security Level (SL) target della zona macchina (IEC 62443): []SL1 []SL2 []SL3 []SL4 []Non specificato
[] Switch di rete OT: []Managed, port security, 802.1X, VLAN tagging []Unmanaged []Marca/modello: txt()
[] NAT / port-forwarding tra rete OT e IT: []Configurato []Non consentito, data diode/proxy []Da definire
[] Bus di campo industriali presenti: []PROFINET []EtherCAT []EtherNet/IP []Modbus TCP []Altro: txt()
[] Sistema di rilevamento anomalie di rete (IDS/NIDS industriale, es. Claroty, Nozomi, Tenable.OT): []Presente []In valutazione []Assente []Specificare: txt()
[] Servizi DNS/NTP/DHCP utilizzati dalla macchina: []Server interni Cliente []Server di zona OT dedicati []Solo locali macchina
num 16.3 Identita, accessi e accesso remoto
[] Active Directory / Identity Provider Cliente: []Da integrare con HMI/SCADA []Account locali []Misto
[] Autenticazione multi-fattore (MFA) richiesta: []Si, per accesso remoto []Si, anche locale []No
[] Politica password (lunghezza, scadenza, complessita): txt()
[] Modalita accesso remoto FG Automazioni autorizzata: []VPN Cliente []Jump host []Router industriale, TeamViewer IoT, Ewon, Siemens SINEMA, ecc. []Non consentito
[] Logging accessi remoti e locali: []Richiesto su SIEM Cliente []Locale su HMI/PLC []Non richiesto
[] Profili utente RBAC su HMI/SCADA da implementare: []Operatore, solo lettura/avvio []Manutentore, parametri di processo []Admin, configurazione []Service FG Automazioni
[] Account di servizio macchina (PLC, drives, IoT gateway): []Modifica password di default obbligatoria al collaudo []Vault credenziali Cliente []Consegna in busta sigillata
[] Gestione personale FG Automazioni in sito, badge, scorta, NDA: txt()
[] Tracciamento sessioni di teleassistenza: []Approvazione preventiva del Cliente per ogni sessione []Registrazione video/log della sessione []Solo log connessione
[] Time-out automatico sessioni HMI inattive: []5 min []15 min []Custom: txt() []Disabilitato, con giustificazione
num 16.4 Hardening dei componenti e gestione vulnerabilità
[] Hardening OS PC industriali (HMI/Edge/Vision): []Disabilitazione USB []Whitelisting applicazioni []Antivirus/EDR []Standard: txt()
[] Patch management OS e firmware (PLC, drives, switch): []A carico Cliente []A carico FG Automazioni []Da definire in contratto SLA
[] SBOM (Software Bill of Materials) richiesta: []Si []No
[] Cifratura comunicazioni (TLS, OPC UA Sign&Encrypt, VPN): []Richiesta []Non necessaria
[] Inventario asset OT da consegnare (PLC, HMI, drives, switch, gateway): []Standard, marca/modello/firmware []Esteso, CVE/EOL/fornitore/criticità
[] Asset critici identificati come "key components" (Art. 21 Dir. NIS2): txt()
[] Disabilitazione protocolli/servizi non utilizzati (Telnet, FTP, SNMP v1/v2, HTTP in chiaro): []Standard al collaudo []Eccezioni motivate
[] Gestione media rimovibili (USB, schede SD): []Porte fisicamente disabilitate []Stazione di sanitizzazione USB Cliente []Whitelist dispositivi []Libero, sconsigliato
[] Vulnerability scan / penetration test pre-collaudo: []Richiesto a FG Automazioni []Eseguito da terza parte Cliente []Non richiesto
[] Sincronizzazione orologi (NTP) per coerenza dei log: []Server NTP Cliente []Internet, pool.ntp.org []Locale RTC PLC
num 16.5 Backup, ripristino e continuita operativa
[] Backup programmi PLC/HMI/SCADA: []A carico FG Automazioni, consegna []Backup periodico a carico Cliente []Servizio gestito FG, SLA
[] Frequenza backup richiesta: []Giornaliera []Settimanale []Mensile []Solo a fronte di modifiche
[] RTO (Recovery Time Objective): txt()
[] RPO (Recovery Point Objective): txt()
[] Test ripristino periodico previsto: []Si []No []Frequenza: txt()
num 16.6 Gestione incidenti e responsabilita (Art. 23 Dir. NIS2)
[] Procedura segnalazione incidenti del Cliente fornita a FG Automazioni: []Si []No []Da fornire
[] Tempi di notifica concordati (early warning 24h, notifica 72h): []Definiti in contratto []Da definire
[] Clausole NIS2 / supply-chain security previste in contratto (Art. 21 lett. D): []Si []Da inserire
[] Risk assessment OT richiesto come deliverable: []Si []No
_ txt(Compilato da) | txt(Data) | txt(Firma) _
/
