import type { ParsedFormSnapshot } from "./commission-intake-template.js";

export const COMMISSION_INTAKE_TEMPLATE_SNAPSHOT = {
  "sourcePath": "embedded:commission-intake-template-snapshot",
  "sourceHash": "a583ce8ed562a1c9818696003d87854bfcead041060160c9c2fc85d383a8ba27",
  "pages": [
    {
      "key": "informazioni_generali_progetto",
      "title": "INFORMAZIONI GENERALI PROGETTO",
      "pageNumber": 1,
      "sortOrder": 1,
      "sections": [
        {
          "key": "main",
          "title": "Dati generali",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "general_commission_number",
              "label": "Nr. Commessa",
              "placeholder": "Nr. Commessa",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": true,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "general_customer",
              "label": "Cliente",
              "placeholder": "Cliente",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": true,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "general_project_description",
              "label": "Descrizione progetto",
              "placeholder": "Descrizione progetto",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": true,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "general_customer_technical_contact",
              "label": "Tecnico / Produzione cliente",
              "placeholder": "Tecnico / Produzione cliente",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": true,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "general_site_visit_date",
              "label": "Data Sopralluogo",
              "placeholder": "Data Sopralluogo",
              "helpText": null,
              "fieldType": "DATE",
              "dataKind": "DATE",
              "required": false,
              "indexed": true,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "general_plant",
              "label": "Stabilimento / Plant",
              "placeholder": "Stabilimento / Plant",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": true,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "general_department_line",
              "label": "Reparto / Linea produttiva",
              "placeholder": "Reparto / Linea produttiva",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            },
            {
              "key": "general_fg_representative",
              "label": "Referente FG Automazioni",
              "placeholder": "Referente FG Automazioni",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": true,
              "sortOrder": 8,
              "options": [],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "processo_produttivo_attuale",
      "title": "PROCESSO PRODUTTIVO ATTUALE",
      "pageNumber": 2,
      "sortOrder": 2,
      "sections": [
        {
          "key": "section_2_1_descrizione_generale",
          "title": "2.1 Descrizione Generale",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p02_f001_descrizione_dettagliata_del_processo_attuale",
              "label": "Descrizione dettagliata del processo attuale",
              "placeholder": "Descrizione dettagliata del processo attuale",
              "helpText": null,
              "fieldType": "LONG_TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_2_2_fasi_del_processo",
          "title": "2.2 Fasi del Processo",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p02_f001_2_2_fasi_del_processo",
              "label": "2.2 Fasi del Processo",
              "placeholder": null,
              "helpText": null,
              "fieldType": "TABLE",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": {
                "columns": [
                  {
                    "key": "col_1_n",
                    "label": "Numero",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 1
                  },
                  {
                    "key": "col_2_fase",
                    "label": "Fase",
                    "placeholder": "Fase",
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 2
                  },
                  {
                    "key": "col_3_manuale_auto",
                    "label": "Manuale / auto",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 3
                  },
                  {
                    "key": "col_4_tempo_ciclo",
                    "label": "Tempo ciclo",
                    "placeholder": "Tempo ciclo",
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 4
                  }
                ],
                "defaultRows": []
              }
            }
          ]
        },
        {
          "key": "section_2_3_dati_operativi_attuali",
          "title": "2.3 Dati Operativi Attuali",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p02_f001_cadenza_produttiva_attuale_pz_h_pz_turno",
              "label": "Cadenza produttiva attuale (pz/h, pz/turno)",
              "placeholder": "Cadenza produttiva attuale (pz/h, pz/turno)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p02_f002_numero_turni_lavoro",
              "label": "Numero turni lavoro",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "1 turno",
                "2 turni",
                "3 turni",
                "Continuo"
              ],
              "table": null
            },
            {
              "key": "p02_f003_numero_operatori_coinvolti_nel_processo",
              "label": "Numero operatori coinvolti nel processo",
              "placeholder": "Numero operatori coinvolti nel processo",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p02_f004_oee_attuale_se_disponibile",
              "label": "OEE attuale (se disponibile): %",
              "placeholder": "OEE attuale (se disponibile): %",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p02_f005_tempo_di_setup_cambio_formato",
              "label": "Tempo di setup / cambio formato",
              "placeholder": "Tempo di setup / cambio formato",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p02_f006_tasso_di_scarto_attuale",
              "label": "Tasso di scarto attuale: %",
              "placeholder": "Tasso di scarto attuale: %",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p02_f007_principali_cause_di_fermo",
              "label": "Principali cause di fermo",
              "placeholder": "Principali cause di fermo",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            },
            {
              "key": "p02_f008_mtbf_mean_time_between_failures",
              "label": "MTBF (Mean Time Between Failures)",
              "placeholder": "MTBF (Mean Time Between Failures)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [],
              "table": null
            },
            {
              "key": "p02_f009_mttr_mean_time_to_repair",
              "label": "MTTR (Mean Time To Repair)",
              "placeholder": "MTTR (Mean Time To Repair)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 9,
              "options": [],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "prodotto_componente_da_lavorare",
      "title": "PRODOTTO/COMPONENTE DA LAVORARE",
      "pageNumber": 3,
      "sortOrder": 3,
      "sections": [
        {
          "key": "section_3_1_caratteristiche_fisiche",
          "title": "3.1 Caratteristiche fisiche",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p03_f001_tipologia_prodotto",
              "label": "Tipologia prodotto",
              "placeholder": "Tipologia prodotto",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f002_materiale",
              "label": "Materiale",
              "placeholder": "Materiale",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f003_dimensioni_l_x_p_x_h_mm",
              "label": "Dimensioni (L x P x H mm)",
              "placeholder": "Dimensioni (L x P x H mm)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f004_peso_kg",
              "label": "Peso (Kg)",
              "placeholder": "Peso (Kg)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f005_forma_geometrica",
              "label": "Forma geometrica",
              "placeholder": "Forma geometrica",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f006_tolleranze_dimensionali",
              "label": "Tolleranze dimensionali",
              "placeholder": "Tolleranze dimensionali",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f007_finitura_superficiale_richiesta",
              "label": "Finitura superficiale richiesta",
              "placeholder": "Finitura superficiale richiesta",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f008_temperatura_di_processo_se_applicabile",
              "label": "Temperatura di processo (se applicabile)",
              "placeholder": "Temperatura di processo (se applicabile)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f009_fragilita_delicatezza",
              "label": "Fragilità  / Delicatezza",
              "placeholder": "Fragilità  / Delicatezza",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 9,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_3_2_varianti_e_formati",
          "title": "3.2 Varianti e Formati",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p03_f001_3_2_varianti_e_formati",
              "label": "3.2 Varianti e Formati",
              "placeholder": null,
              "helpText": null,
              "fieldType": "TABLE",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": {
                "columns": [
                  {
                    "key": "col_1_codice_sku",
                    "label": "Codice/SKU",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 1
                  },
                  {
                    "key": "col_2_dimensioni",
                    "label": "Dimensioni",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 2
                  },
                  {
                    "key": "col_3_peso",
                    "label": "Peso",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 3
                  },
                  {
                    "key": "col_4_produzione",
                    "label": "% Produzione",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 4
                  }
                ],
                "defaultRows": []
              }
            }
          ]
        },
        {
          "key": "section_3_3_specifiche_qualitative",
          "title": "3.3 Specifiche Qualitàtive",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p03_f001_parametri_critici_da_controllare",
              "label": "Parametri critici da controllare",
              "placeholder": "Parametri critici da controllare",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f002_tolleranze_qualitative",
              "label": "Tolleranze qualitàtive",
              "placeholder": "Tolleranze qualitàtive",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f003_controlli_qualita_richiesti",
              "label": "Controlli qualità  richiesti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Visivo",
                "Dimensionale",
                "Funzionale",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p03_f004_normative_di_riferimento_es_iso_ce_fda",
              "label": "Normative di riferimento (es. ISO, CE, FDA)",
              "placeholder": "Normative di riferimento (es. ISO, CE, FDA)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p03_f005_tracciabilita_richiesta",
              "label": "Tracciabilità  richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Lotto",
                "Seriale",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p03_f006_campionamento_ogni_pezzi",
              "label": "Campionamento: ogni pezzi",
              "placeholder": "Campionamento: ogni pezzi",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "obiettivi_e_requisiti_automazione",
      "title": "OBIETTIVI E REQUISITI AUTOMAZIONE",
      "pageNumber": 4,
      "sortOrder": 4,
      "sections": [
        {
          "key": "section_4_1_obiettivi_produttivi",
          "title": "4.1 Obiettivi Produttivi",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p04_f001_cadenza_produttiva_target_pz_h",
              "label": "Cadenza produttiva target (pz/h)",
              "placeholder": "Cadenza produttiva target (pz/h)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f002_volume_produttivo_annuo_previsto",
              "label": "Volume produttivo annuo previsto",
              "placeholder": "Volume produttivo annuo previsto",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f003_incremento_produttivita_desiderato",
              "label": "Incremento produttività  desiderato: %",
              "placeholder": "Incremento produttività  desiderato: %",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f004_riduzione_scarti_target",
              "label": "Riduzione scarti target: %",
              "placeholder": "Riduzione scarti target: %",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f005_oee_target",
              "label": "OEE target: %",
              "placeholder": "OEE target: %",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f006_tempo_di_ciclo_massimo_accettabile",
              "label": "Tempo di ciclo massimo accettabile",
              "placeholder": "Tempo di ciclo massimo accettabile",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_4_2_operazioni_da_automatizzare_indicare_le_operazioni_da_automatizzare_in_ordin",
          "title": "4.2 Operazioni da Automatizzare - indicare le operazioni da automatizzare in ordine di priorità ",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p04_f001_alimentazione_carico_materiale",
              "label": "Alimentazione / Carico materiale",
              "placeholder": "Alimentazione / Carico materiale",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f002_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f003_prelievo_manipolazione",
              "label": "Prelievo / Manipolazione",
              "placeholder": "Prelievo / Manipolazione",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f004_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f005_posizionamento_orientamento",
              "label": "Posizionamento / Orientamento",
              "placeholder": "Posizionamento / Orientamento",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f006_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f007_assemblaggio_componenti",
              "label": "Assemblaggio componenti",
              "placeholder": "Assemblaggio componenti",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f008_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f009_lavorazione_meccanica",
              "label": "Lavorazione meccanica",
              "placeholder": "Lavorazione meccanica",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 9,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f010_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 10,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f011_saldatura_incollaggio",
              "label": "Saldatura / Incollaggio",
              "placeholder": "Saldatura / Incollaggio",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 11,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f012_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 12,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f013_controllo_qualita_visivo",
              "label": "Controllo qualità  visivo",
              "placeholder": "Controllo qualità  visivo",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 13,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f014_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 14,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f015_controllo_dimensionale",
              "label": "Controllo dimensionale",
              "placeholder": "Controllo dimensionale",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 15,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f016_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 16,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f017_marcatura_etichettatura",
              "label": "Marcatura / etichettatura",
              "placeholder": "Marcatura / etichettatura",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 17,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f018_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 18,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f019_imballaggio_confezionamento",
              "label": "Imballaggio / confezionamento",
              "placeholder": "Imballaggio / confezionamento",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 19,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f020_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 20,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f021_palletizzazione",
              "label": "Palletizzazione",
              "placeholder": "Palletizzazione",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 21,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f022_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 22,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f023_scarico_evacuazione",
              "label": "Scarico / Evacuazione",
              "placeholder": "Scarico / Evacuazione",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 23,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f024_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 24,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            },
            {
              "key": "p04_f025_altro",
              "label": "Altro",
              "placeholder": "Altro",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 25,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f026_priorita",
              "label": "priorità ",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 26,
              "options": [
                "Alta",
                "Media",
                "Bassa"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_4_3_livello_di_automazione_richiesto",
          "title": "4.3 Livello di Automazione Richiesto",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p04_f001_automazione_parziale_isole_automatizzate_operatori",
              "label": "Automazione parziale (isole automatizzate + operatori)",
              "placeholder": "Automazione parziale (isole automatizzate + operatori)",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f002_automazione_completa_della_linea",
              "label": "Automazione completa della linea",
              "placeholder": "Automazione completa della linea",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f003_sistema_semi_automatico_assistenza_operatore",
              "label": "Sistema semi-automatico (assistenza operatore)",
              "placeholder": "Sistema semi-automatico (assistenza operatore)",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f004_collaborativo_cobot_operatore",
              "label": "Collaborativo (cobot + operatore)",
              "placeholder": "Collaborativo (cobot + operatore)",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p04_f005_flessibilita_richiesta",
              "label": "Flessibilità  richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Mono-prodotto",
                "Multi-formato",
                "Multi-prodotto"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "spazio_e_layout_disponibile",
      "title": "SPAZIO E LAYOUT DISPONIBILE",
      "pageNumber": 5,
      "sortOrder": 5,
      "sections": [
        {
          "key": "section_5_1_dimensioni_area",
          "title": "5.1 Dimensioni Area",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p05_f001_spazio_disponibile_l_x_p_x_h_metri",
              "label": "Spazio disponibile (L x P x H metri)",
              "placeholder": "Spazio disponibile (L x P x H metri)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p05_f002_planimetria_allegata",
              "label": "Planimetria allegata",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p05_f003_foto_area_disponibili",
              "label": "Foto area disponibili",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p05_f004_vincoli_dimensionali",
              "label": "Vincoli dimensionali",
              "placeholder": "Vincoli dimensionali",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p05_f005_altezza_utile_disponibile_metri",
              "label": "Altezza utile disponibile: metri",
              "placeholder": "Altezza utile disponibile: metri",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p05_f006_portata_pavimento_kg_m2",
              "label": "Portata pavimento: kg/m2",
              "placeholder": "Portata pavimento: kg/m2",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p05_f007_accessi_vie_di_fuga_da_mantenere",
              "label": "Accessi/Vie di fuga da mantenere",
              "placeholder": "Accessi/Vie di fuga da mantenere",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_5_2_integrazione_con_linea_esistente",
          "title": "5.2 Integrazione con Linea Esistente",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p05_f001_sistema_standalone",
              "label": "Sistema standalone",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p05_f002_integrazione_con_macchine_esistenti",
              "label": "Integrazione con macchine esistenti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p05_f003_macchine_a_monte",
              "label": "Macchine a monte",
              "placeholder": "Macchine a monte",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p05_f004_macchine_a_valle",
              "label": "Macchine a valle",
              "placeholder": "Macchine a valle",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p05_f005_sistema_di_trasporto_esistente",
              "label": "Sistema di trasporto esistente",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Nastri",
                "Rulli",
                "Catene",
                "AGV",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p05_f006_altezza_piano_di_lavoro_esistente_mm",
              "label": "Altezza piano di lavoro esistente: mm",
              "placeholder": "valore approssimato",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "utilities_e_infrastrutture",
      "title": "UTILITIES E INFRASTRUTTURE",
      "pageNumber": 6,
      "sortOrder": 6,
      "sections": [
        {
          "key": "section_6_1_alimentazione_elettrica",
          "title": "6.1 Alimentazione Elettrica",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p06_f001_tensione_disponibile",
              "label": "Tensione disponibile",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "230V 1F",
                "400V 3F",
                "Altra"
              ],
              "table": null
            },
            {
              "key": "p06_f002_potenza_disponibile_kw",
              "label": "Potenza disponibile: kW",
              "placeholder": "Potenza disponibile: kW",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f003_posizione_quadro_elettrico_principale",
              "label": "Posizione quadro elettrico principale",
              "placeholder": "Posizione quadro elettrico principale",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f004_distanza_dalla_macchina_metri",
              "label": "Distanza dalla macchina: metri",
              "placeholder": "Distanza dalla macchina: metri",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f005_sistema_di_messa_a_terra",
              "label": "Sistema di messa a terra",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Presente",
                "Da verificare"
              ],
              "table": null
            },
            {
              "key": "p06_f006_ups_gruppo_di_continuita",
              "label": "UPS / Gruppo di continuità",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Presente",
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_6_2_aria_compressa",
          "title": "6.2 Aria compressa",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p06_f001_aria_compressa_disponibile",
              "label": "Aria compressa disponibile",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p06_f002_pressione_disponibile_bar",
              "label": "Pressione disponibile: bar",
              "placeholder": "Pressione disponibile: bar",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f003_portata_disponibile_nl_min",
              "label": "Portata disponibile: Nl/min",
              "placeholder": "Portata disponibile: Nl/min",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f004_qualita_aria_iso_8573_1_classe_solidi_acqua_olio",
              "label": "Qualità  aria (ISO 8573-1): Classe solidi: Acqua: Olio",
              "placeholder": "Qualità  aria (ISO 8573-1): Classe solidi: Acqua: Olio",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f005_punto_di_rugiada_c",
              "label": "Punto di rugiada: °C",
              "placeholder": "Punto di rugiada: °C",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f006_distanza_punto_di_ripresa_metri",
              "label": "Distanza punto di ripresa: metri",
              "placeholder": "Distanza punto di ripresa: metri",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_6_3_altre_utilities",
          "title": "6.3 Altre utilities",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p06_f001_acqua_industriale_pressione_bar",
              "label": "Acqua industriale: Pressione: bar",
              "placeholder": "Acqua industriale: Pressione: bar",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f002_vuoto_livello_mbar",
              "label": "Vuoto: Livello: mbar",
              "placeholder": "Vuoto: Livello: mbar",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f003_gas_speciali_specificare",
              "label": "Gas speciali: specificare",
              "placeholder": "Gas speciali: specificare",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p06_f004_aria_condizionata_temperatura",
              "label": "Aria condizionata, Temperatura",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "°C, Umidità ",
                "%"
              ],
              "table": null
            },
            {
              "key": "p06_f005_illuminazione_area",
              "label": "Illuminazione area",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Adeguata",
                "Da integrare Lux"
              ],
              "table": null
            },
            {
              "key": "p06_f006_aspirazione_fumi_polveri",
              "label": "Aspirazione fumi/polveri",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Presente",
                "Richiesta"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "controllo_supervisione_e_integrazione_it",
      "title": "CONTROLLO,SUPERVISIONE E INTEGRAZIONE IT",
      "pageNumber": 7,
      "sortOrder": 7,
      "sections": [
        {
          "key": "section_7_1_sistema_di_controllo",
          "title": "7.1 Sistema di Controllo",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p07_f001_plc_esistente_in_plant",
              "label": "PLC esistente in plant",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Siemens",
                "Allen-Bradley",
                "Omron",
                "Altro: Quantità "
              ],
              "table": null
            },
            {
              "key": "p07_f002_standard_richiesto",
              "label": "Standard richiesto",
              "placeholder": "Standard richiesto",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p07_f003_hmi_richiesto",
              "label": "HMI richiesto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Touch panel locale",
                "PC industriale",
                "Entrambi",
                "Quantità "
              ],
              "table": null
            },
            {
              "key": "p07_f004_dimensione_hmi_preferita",
              "label": "Dimensione HMI preferita",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "7\"",
                "10\"",
                "15\"",
                "21\"",
                "Altra:\""
              ],
              "table": null
            },
            {
              "key": "p07_f005_lingua_interfaccia",
              "label": "Lingua interfaccia",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Italiana",
                "Inglese",
                "Tedesca",
                "Multilingua"
              ],
              "table": null
            },
            {
              "key": "p07_f006_livelli_utente_richiesti",
              "label": "Livelli utente richiesti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Operatore",
                "Manutentore",
                "Manager",
                "Sviluppatore"
              ],
              "table": null
            },
            {
              "key": "p07_f007_altro",
              "label": "Altro",
              "placeholder": "Altro",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_7_2_connettivita_e_integrazione",
          "title": "7.2 Connettività e integrazione",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p07_f001_rete_aziendale_disponibile",
              "label": "Rete aziendale disponibile",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p07_f002_tipo_rete",
              "label": "Tipo rete",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Ethernet",
                "Profinet",
                "EtherCAT",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p07_f003_indirizzo_ip_richiesto",
              "label": "Indirizzo IP richiesto",
              "placeholder": "Indirizzo IP richiesto",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p07_f004_vpn_per_assistenza_remota",
              "label": "VPN per assistenza remota",
              "placeholder": "VPN per assistenza remota",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p07_f005_firewall_restrizioni_di_rete_presenti_dettagli",
              "label": "Firewall / Restrizioni di rete presenti. Dettagli",
              "placeholder": "Firewall / Restrizioni di rete presenti. Dettagli",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_7_3_sistemi_gestionali_mes_erp",
          "title": "7.3 Sistemi Gestionali (MES / ERP)",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p07_f001_mes_erp_presente_dettagli",
              "label": "MES / ERP presente. Dettagli",
              "placeholder": "MES / ERP presente. Dettagli",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p07_f002_integrazione_richiesta",
              "label": "Integrazione richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p07_f003_protocollo_comunicazione",
              "label": "Protocollo comunicazione",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "OPC UA",
                "OPC DA",
                "MQTT",
                "REST API",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p07_f004_dati_da_scambiare",
              "label": "Dati da scambiare",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Produzione",
                "Allarmi",
                "Qualità ",
                "Tracciabilità ",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p07_f005_database_produzione",
              "label": "Database produzione",
              "placeholder": "Database produzione",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p07_f006_report_automatici",
              "label": "Report automatici",
              "placeholder": "Report automatici",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_7_4_industria_4_0_e_digital_twin",
          "title": "7.4 Industria 4.0 e Digital Twin",
          "description": null,
          "sortOrder": 4,
          "fields": [
            {
              "key": "p07_f001_requisiti_industria_4_0_per_incentivi",
              "label": "Requisiti Industria 4.0 per incentivi",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p07_f002_interconnessione_richiesta",
              "label": "Interconnessione richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p07_f003_monitoraggio_remoto",
              "label": "Monitoraggio remoto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p07_f004_predictive_maintenance",
              "label": "Predictive maintenance",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p07_f005_digital_twin",
              "label": "Digital Twin",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p07_f006_dashboard_real_time",
              "label": "Dashboard real-time",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "visione_artificiale_e_intelligenza_artificiale",
      "title": "VISIONE ARTIFICIALE E INTELLIGENZA ARTIFICIALE",
      "pageNumber": 8,
      "sortOrder": 8,
      "sections": [
        {
          "key": "section_8_1_controllo_visivo",
          "title": "8.1 Controllo Visivo",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p08_f001_controllo_qualita_visivo_richiesto",
              "label": "Controllo qualità visivo richiesto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p08_f002_difetti_da_rilevare",
              "label": "Difetti da rilevare",
              "placeholder": "Difetti da rilevare",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f003_dimensione_minima_difetto_mm",
              "label": "Dimensione minima difetto: mm",
              "placeholder": "Dimensione minima difetto: mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f004_contrasto_difetto_sfondo",
              "label": "Contrasto difetto/sfondo",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Alto",
                "Medio",
                "Basso"
              ],
              "table": null
            },
            {
              "key": "p08_f005_superfici_da_ispezionare",
              "label": "Superfici da ispezionare",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Piane",
                "Curve",
                "3D complesse"
              ],
              "table": null
            },
            {
              "key": "p08_f006_velocita_ispezione_pz_min",
              "label": "Velocità ispezione: pz/min",
              "placeholder": "Velocità ispezione: pz/min",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f007_illuminazione_critica",
              "label": "Illuminazione critica",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_8_2_posizionamento_riconoscimento",
          "title": "8.2 Posizionamento/Riconoscimento",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p08_f001_visione_per_posizionamento",
              "label": "Visione per posizionamento",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p08_f002_tipo_riconoscimento",
              "label": "Tipo riconoscimento",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Pattern matching",
                "Blob analysis",
                "OCR",
                "Codici 1D/2D"
              ],
              "table": null
            },
            {
              "key": "p08_f003_telecamera",
              "label": "Telecamera",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Global Shutter",
                "Rolling Shutter",
                "Line Scan",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p08_f004_quantita",
              "label": "Quantità",
              "placeholder": "Quantità",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f005_precisione_posizionamento_richiesta_mm",
              "label": "Precisione posizionamento richiesta: +/- mm",
              "placeholder": "Precisione posizionamento richiesta: +/- mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f006_campo_visivo_fov_x_mm",
              "label": "Campo visivo (FOV): x mm",
              "placeholder": "Campo visivo (FOV): x mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f007_distanza_di_lavoro_mm",
              "label": "Distanza di lavoro: mm",
              "placeholder": "Distanza di lavoro: mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f008_tempo_ciclo_visione_ms",
              "label": "Tempo ciclo visione: ms",
              "placeholder": "Tempo ciclo visione: ms",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_8_3_ai_e_deep_learning",
          "title": "8.3 AI e Deep Learning",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p08_f001_ai_per_ispezione",
              "label": "AI per ispezione",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p08_f002_casistiche_complesse_variabili",
              "label": "Casistiche complesse/variabili",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p08_f003_dataset_immagini_disponibili",
              "label": "Dataset immagini disponibili",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Sì, quantità",
                "No"
              ],
              "table": null
            },
            {
              "key": "p08_f004_training_necessario",
              "label": "Training necessario",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p08_f005_classificazione_difetti",
              "label": "Classificazione difetti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p08_f006_self_learning",
              "label": "Self-learning",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_8_4_conformita_ai_act_reg_ue_2024_1689",
          "title": "8.4 Conformità AI Act (Reg. UE 2024/1689)",
          "description": null,
          "sortOrder": 4,
          "fields": [
            {
              "key": "p08_f001_classificazione_del_sistema_ai",
              "label": "Classificazione del sistema AI",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Rischio minimo",
                "Rischio limitato",
                "Rischio alto (componente di sicurezza ex All. I)",
                "Da valutare"
              ],
              "table": null
            },
            {
              "key": "p08_f002_il_sistema_ai_partecipa_a_funzioni_di_sicurezza_macchina",
              "label": "Il sistema AI partecipa a funzioni di sicurezza macchina",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "No, solo qualità/produzione"
              ],
              "table": null
            },
            {
              "key": "p08_f003_alfabetizzazione_ai_del_personale_cliente_garantita_art_4_ai_act",
              "label": "Alfabetizzazione AI del personale Cliente garantita (Art. 4 AI Act)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": true,
              "sortOrder": 3,
              "options": [
                "Sì",
                "Da pianificare"
              ],
              "table": null
            },
            {
              "key": "p08_f004_servizio_richiesto_a_fg_automazioni",
              "label": "Servizio richiesto a FG Automazioni",
              "placeholder": "Servizio richiesto a FG Automazioni",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p08_f005_documentazione_tecnica_ai_dataset_metriche_drift",
              "label": "Documentazione tecnica AI (dataset, metriche, drift)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Standard",
                "Estesa, richiesta dal Cliente"
              ],
              "table": null
            },
            {
              "key": "p08_f006_sorveglianza_umana_e_gestione_drift_modello_human_oversight",
              "label": "Sorveglianza umana e gestione drift modello (Human Oversight)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Operatore conferma esiti",
                "Audit periodici",
                "Automatica con allarme"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "robotica_e_manipolazione",
      "title": "ROBOTICA E MANIPOLAZIONE",
      "pageNumber": 9,
      "sortOrder": 9,
      "sections": [
        {
          "key": "section_9_1_manipolazione_robotizzata",
          "title": "9.1 Manipolazione Robotizzata",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p09_f001_robot_richiesto",
              "label": "Robot richiesto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No",
                "Sì, quantità"
              ],
              "table": null
            },
            {
              "key": "p09_f002_tipologia",
              "label": "Tipologia",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Antropomorfo",
                "SCARA",
                "Delta",
                "Cartesiano",
                "Cobot"
              ],
              "table": null
            },
            {
              "key": "p09_f003_payload_richiesto_kg",
              "label": "Payload richiesto: kg",
              "placeholder": "Payload richiesto: kg",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f004_raggio_di_lavoro_mm",
              "label": "Raggio di lavoro: mm",
              "placeholder": "Raggio di lavoro: mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f005_numero_assi",
              "label": "Numero assi",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "4",
                "6",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p09_f006_precisione_ripetibilita_mm",
              "label": "Precisione ripetibilita: +/- mm",
              "placeholder": "Precisione ripetibilita: +/- mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f007_velocita_movimento",
              "label": "Velocità movimento",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [
                "Standard",
                "Alta velocità"
              ],
              "table": null
            },
            {
              "key": "p09_f008_ambiente",
              "label": "Ambiente",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [
                "Standard",
                "Cleanroom",
                "ATEX",
                "Alimentare"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_9_2_prese_e_end_effector",
          "title": "9.2 Prese e End-Effector",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p09_f001_tipologia_presa",
              "label": "Tipologia presa",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Ventosa",
                "Pinza meccanica",
                "Pinza magnetica",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p09_f002_numero_punti_di_presa_simultanei",
              "label": "Numero punti di presa simultanei",
              "placeholder": "Numero punti di presa simultanei",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f003_forza_presa_richiesta_n",
              "label": "Forza presa richiesta: N",
              "placeholder": "Forza presa richiesta: N",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f004_cambio_utensile_automatico",
              "label": "Cambio utensile automatico",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p09_f005_sensori_su_gripper",
              "label": "Sensori su gripper",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Forza/Coppia",
                "Presenza pezzo",
                "Altro"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_9_3_movimentazione_materiali",
          "title": "9.3 Movimentazione Materiali",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p09_f001_sistema_trasporto",
              "label": "Sistema trasporto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Nastri",
                "Rulli",
                "Catene",
                "Slat",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p09_f002_velocita_trasporto_m_min",
              "label": "Velocità trasporto: m/min",
              "placeholder": "Velocità trasporto: m/min",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f003_larghezza_nastro_mm",
              "label": "Larghezza nastro: mm",
              "placeholder": "Larghezza nastro: mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f004_passo_prodotti_sul_nastro_mm",
              "label": "Passo prodotti sul nastro: mm",
              "placeholder": "Passo prodotti sul nastro: mm",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p09_f005_accumulo_buffer",
              "label": "Accumulo buffer",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesto",
                "Non necessario",
                "Capacita: pz"
              ],
              "table": null
            },
            {
              "key": "p09_f006_agv_amr",
              "label": "AGV/AMR",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_9_4_vendor_list_componenti_standard_fg_automazioni",
          "title": "9.4 Vendor List componenti (standard FG Automazioni)",
          "description": null,
          "sortOrder": 4,
          "fields": [
            {
              "key": "p09_f001_9_4_vendor_list_componenti_standard_fg_automazioni",
              "label": "9.4 Vendor List componenti (standard FG Automazioni)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "TABLE",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": {
                "columns": [
                  {
                    "key": "col_1_categoria",
                    "label": "Categoria",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 1
                  },
                  {
                    "key": "col_2_componente",
                    "label": "Componente",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 2
                  },
                  {
                    "key": "col_3_marche_di_riferimento",
                    "label": "Marche di riferimento",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 3
                  },
                  {
                    "key": "col_4_confermato",
                    "label": "Confermato",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 4
                  },
                  {
                    "key": "col_5_altro",
                    "label": "Altro",
                    "placeholder": null,
                    "dataKind": "STRING",
                    "required": false,
                    "sortOrder": 5
                  }
                ],
                "defaultRows": [
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Componenti di sicurezza",
                    "col_2_componente": "Barriere fotoelettriche di sicurezza",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "REER, KEYENCE, SICK, OMRON, PILZ"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Componenti di sicurezza",
                    "col_2_componente": "Laser scanner di sicurezza",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "REER, KEYENCE, SICK, OMRON, PILZ"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Componenti di sicurezza",
                    "col_2_componente": "Finecorsa elettromeccanici e RFID di sicurezza",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "PIZZATO, SCHMERSAL, SIEMENS, SCHNEIDER"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Componenti di sicurezza",
                    "col_2_componente": "Pulsantiere bimanuali",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SCHNEIDER"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Componenti di sicurezza",
                    "col_2_componente": "Moduli di sicurezza",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS, PILZ, SCHNEIDER"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Componenti di sicurezza",
                    "col_2_componente": "PLC di sicurezza",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS S7-1200, S7-1500"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Componenti di sicurezza",
                    "col_2_componente": "Pulsanti di emergenza",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sensoristica",
                    "col_2_componente": "Sensori fotoelettrici / fotocellule",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "OMRON, KEYENCE"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sensoristica",
                    "col_2_componente": "Fibre ottiche",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "OMRON, KEYENCE"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sensoristica",
                    "col_2_componente": "Fotocellule a forcella",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "BALLUFF"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sensoristica",
                    "col_2_componente": "Sensori induttivi e capacitivi",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "CONTRINEX, BALLUFF, AECO"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sensoristica",
                    "col_2_componente": "Sensori/finecorsa su cilindri e slitte",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SMC, FESTO"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sensoristica",
                    "col_2_componente": "Microinterruttori e finecorsa elettromeccanici",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS, OMRON, PIZZATO"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Materiali per strutture",
                    "col_2_componente": "Profilati in alluminio per strutture",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "BOSCH, ALUTEC"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Pneumatica e manipolazione",
                    "col_2_componente": "Gruppi trattamento aria, avviatori progressivi, valvole, cilindri, slitte, accessori vari",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SMC, FESTO"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Pneumatica e manipolazione",
                    "col_2_componente": "Pinze",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SMC, FESTO, SCHUNK, ZIMMER"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Pneumatica e manipolazione",
                    "col_2_componente": "Pick and place",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "FESTO"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Pneumatica e manipolazione",
                    "col_2_componente": "Sistemi di cambio rapido",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SCHUNK, ZIMMER"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Pneumatica e manipolazione",
                    "col_2_componente": "Sistemi generazione vuoto ed eiettori",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SMC, FESTO, SCHMALZ"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Nastri trasportatori",
                    "col_2_componente": "Nastri trasportatori",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "ALUTEC"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Tavole rotanti e sistemi index",
                    "col_2_componente": "Tavole rotanti e sistemi index",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "WEISS, ITALPLANT, BETTINELLI"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di comando, controllo e misura",
                    "col_2_componente": "PLC",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS serie 1200-1500"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di comando, controllo e misura",
                    "col_2_componente": "CNC",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di comando, controllo e misura",
                    "col_2_componente": "HMI",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di comando, controllo e misura",
                    "col_2_componente": "Motion",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "SIEMENS"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di comando, controllo e misura",
                    "col_2_componente": "Misura",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "NATIONAL INSTRUMENTS"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Robot",
                    "col_2_componente": "Robot antropomorfi",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "KUKA"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Robot",
                    "col_2_componente": "Robot SCARA",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "KUKA"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Robot",
                    "col_2_componente": "Robot collaborativi",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "KUKA"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "AGV e AMR",
                    "col_2_componente": "Payload <= 100 kg",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "KUKA"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "AGV e AMR",
                    "col_2_componente": "Payload > 100 kg",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "KUKA"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Marcatura, tampografia ed etichettatura",
                    "col_2_componente": "Marcatura laser",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "KEYENCE, LASIT, EVLASER"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Marcatura, tampografia ed etichettatura",
                    "col_2_componente": "Tampografia",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "COMEC, TAMPOPRINT"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Marcatura, tampografia ed etichettatura",
                    "col_2_componente": "Etichettatrici",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "2 EMME, RETEL, CAB"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di visione e lettori",
                    "col_2_componente": "Sistemi di visione",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "VISIOFY, COGNEX, KEYENCE"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di visione e lettori",
                    "col_2_componente": "Sensori di visione",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "IMAGES, COGNEX, KEYENCE"
                  },
                  {
                    "col_5_altro": "",
                    "col_1_categoria": "Sistemi di visione e lettori",
                    "col_2_componente": "Lettori barcode / QR code",
                    "col_4_confermato": "",
                    "col_3_marche_di_riferimento": "IMAGES, COGNEX, KEYENCE, DATALOGIC"
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "key": "sicurezza_e_normative",
      "title": "SICUREZZA E NORMATIVE",
      "pageNumber": 10,
      "sortOrder": 10,
      "sections": [
        {
          "key": "section_10_1_dispositivi_di_sicurezza",
          "title": "10.1 Dispositivi di Sicurezza",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p10_f001_categoria_sicurezza_richiesta",
              "label": "Categoria sicurezza richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Cat. 3",
                "Cat. 4",
                "PLd",
                "PLe"
              ],
              "table": null
            },
            {
              "key": "p10_f002_recinzioni_barriere",
              "label": "Recinzioni/Barriere",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Richieste",
                "Non necessarie"
              ],
              "table": null
            },
            {
              "key": "p10_f003_barriere_ottiche",
              "label": "Barriere ottiche",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Richieste",
                "Non necessarie"
              ],
              "table": null
            },
            {
              "key": "p10_f004_scanner_laser_sicurezza",
              "label": "Scanner laser sicurezza",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Richiesti",
                "Non necessari"
              ],
              "table": null
            },
            {
              "key": "p10_f005_tappeti_bordi_sensibili",
              "label": "Tappeti/Bordi sensibili",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesti",
                "Non necessari"
              ],
              "table": null
            },
            {
              "key": "p10_f006_arresto_emergenza",
              "label": "Arresto emergenza",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "A fungo",
                "A fune",
                "Entrambi"
              ],
              "table": null
            },
            {
              "key": "p10_f007_blocco_porte",
              "label": "Blocco porte",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [
                "Con interblocco",
                "Con ritardo"
              ],
              "table": null
            },
            {
              "key": "p10_f008_segnalazioni_luminose",
              "label": "Segnalazioni luminose",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [
                "Torretta",
                "Lampeggianti",
                "Entrambi"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_10_2_normative_e_certificazioni",
          "title": "10.2 Normative e Certificazioni",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p10_f001_marcatura_ce",
              "label": "Marcatura CE",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Richiesta, obbligatoria"
              ],
              "table": null
            },
            {
              "key": "p10_f002_direttiva_macchine_2006_42_ce",
              "label": "Direttiva Macchine 2006/42/CE",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Applicabile"
              ],
              "table": null
            },
            {
              "key": "p10_f003_normative_specifiche_settore",
              "label": "Normative specifiche settore",
              "placeholder": "Normative specifiche settore",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p10_f004_atex_ambienti_esplosivi",
              "label": "ATEX, ambienti esplosivi",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p10_f005_alimentare_fda_haccp",
              "label": "Alimentare, FDA/HACCP",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p10_f006_farmaceutico_gmp",
              "label": "Farmaceutico, GMP",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p10_f007_analisi_rischio_iso_12100",
              "label": "Analisi rischio, ISO 12100",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [
                "Richiesta"
              ],
              "table": null
            },
            {
              "key": "p10_f008_valutazione_rumore",
              "label": "Valutazione rumore",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [
                "Richiesta",
                "Limite: dB(A)"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_10_3_ergonomia_e_operatore",
          "title": "10.3 Ergonomia e Operatore",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p10_f001_interazione_operatore_macchina",
              "label": "Interazione operatore-macchina",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Frequente",
                "Occasionale",
                "Rara"
              ],
              "table": null
            },
            {
              "key": "p10_f002_altezza_piano_di_lavoro_ergonomica",
              "label": "Altezza piano di lavoro ergonomica",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Richiesta"
              ],
              "table": null
            },
            {
              "key": "p10_f003_accessi_per_manutenzione",
              "label": "Accessi per manutenzione",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Prioritàri"
              ],
              "table": null
            },
            {
              "key": "p10_f004_piattaforme_elevatrici",
              "label": "Piattaforme elevatrici",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Necessarie",
                "Non necessarie"
              ],
              "table": null
            },
            {
              "key": "p10_f005_scarichi_ergonomici",
              "label": "Scarichi ergonomici",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesti"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "manutenzione_e_assistenza",
      "title": "MANUTENZIONE E ASSISTENZA",
      "pageNumber": 11,
      "sortOrder": 11,
      "sections": [
        {
          "key": "section_11_1_requisiti_manutenzione",
          "title": "11.1 Requisiti Manutenzione",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p11_f001_accessibilita_componenti",
              "label": "Accessibilita componenti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Frontale",
                "Laterale",
                "Dall'alto"
              ],
              "table": null
            },
            {
              "key": "p11_f002_modularita_richiesta",
              "label": "Modularita richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p11_f003_quick_change_componenti",
              "label": "Quick-change componenti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Richiesto",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p11_f004_lubrificazione",
              "label": "Lubrificazione",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Automatica",
                "Manuale",
                "Componenti pre-lubrificati"
              ],
              "table": null
            },
            {
              "key": "p11_f005_filtri_aria_olio",
              "label": "Filtri aria/olio",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Standard",
                "Easy access"
              ],
              "table": null
            },
            {
              "key": "p11_f006_diagnostica_avanzata",
              "label": "Diagnostica avanzata",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_11_2_personale_manutentivo",
          "title": "11.2 Personale Manutentivo",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p11_f001_competenze_interne",
              "label": "Competenze interne",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Meccaniche",
                "Elettriche",
                "Software",
                "Nessuna"
              ],
              "table": null
            },
            {
              "key": "p11_f002_training_richiesto",
              "label": "Training richiesto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Operatori",
                "Manutentori",
                "Tecnici"
              ],
              "table": null
            },
            {
              "key": "p11_f003_lingua_formazione",
              "label": "Lingua formazione",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Italiano",
                "Inglese"
              ],
              "table": null
            },
            {
              "key": "p11_f004_manuali_richiesti",
              "label": "Manuali richiesti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Cartacei",
                "Digitali",
                "Video"
              ],
              "table": null
            },
            {
              "key": "p11_f005_ricambi_scorta",
              "label": "Ricambi scorta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Lista consigliata",
                "Kit di avvio"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_11_3_assistenza_post_vendita",
          "title": "11.3 Assistenza Post-Vendita",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p11_f001_contratto_assistenza",
              "label": "Contratto assistenza",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Richiesto",
                "Da valutare",
                "Non necessario"
              ],
              "table": null
            },
            {
              "key": "p11_f002_tempo_intervento_richiesto",
              "label": "Tempo intervento richiesto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "8h",
                "24h",
                "48h"
              ],
              "table": null
            },
            {
              "key": "p11_f003_assistenza_remota",
              "label": "Assistenza remota",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p11_f004_hotline_telefonica",
              "label": "Hotline telefonica",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "8-18",
                "H24",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p11_f005_sla_service_level_agreement",
              "label": "SLA (Service Level Agreement)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesto",
                "Uptime garantito: %"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "collaudo_e_validazione",
      "title": "COLLAUDO E VALIDAZIONE",
      "pageNumber": 12,
      "sortOrder": 12,
      "sections": [
        {
          "key": "section_12_1_fat_factory_acceptance_test",
          "title": "12.1 FAT (Factory Acceptance Test)",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p12_f001_fat_richiesto_presso_costruttore",
              "label": "FAT richiesto presso costruttore",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p12_f002_partecipanti_fat",
              "label": "Partecipanti FAT",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Cliente",
                "End user",
                "Ente certificazione"
              ],
              "table": null
            },
            {
              "key": "p12_f003_test_da_eseguire",
              "label": "Test da eseguire",
              "placeholder": "Test da eseguire",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p12_f004_documentazione_fat",
              "label": "Documentazione FAT",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Richiesta"
              ],
              "table": null
            },
            {
              "key": "p12_f005_materiale_cliente_per_test",
              "label": "Materiale cliente per test",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": true,
              "sortOrder": 5,
              "options": [
                "Fornito da cliente",
                "Fornito da costruttore"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_12_2_sat_site_acceptance_test",
          "title": "12.2 SAT (Site Acceptance Test)",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p12_f001_sat_richiesto",
              "label": "SAT richiesto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p12_f002_durata_collaudo_in_sito_giorni",
              "label": "Durata collaudo in sito: giorni",
              "placeholder": "Durata collaudo in sito: giorni",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p12_f003_produzione_campioni_quantita_minima_pz",
              "label": "Produzione campioni: quantità minima: pz",
              "placeholder": "Produzione campioni: quantità minima: pz",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p12_f004_parametri_kpi_da_raggiungere",
              "label": "Parametri KPI da raggiungere",
              "placeholder": "Parametri KPI da raggiungere",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p12_f005_periodo_garanzia",
              "label": "Periodo garanzia",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "12 mesi",
                "24 mesi",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p12_f006_run_rate_test",
              "label": "Run&Rate test",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Richiesto",
                "Durata: ore/giorni"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_12_3_validazione_iq_oq_pq",
          "title": "12.3 Validazione IQ/OQ/PQ",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p12_f001_validazione_richiesta_pharma_food",
              "label": "Validazione richiesta (Pharma/Food)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p12_f002_iq_installation_qualification",
              "label": "IQ (Installation Qualification)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Richiesta"
              ],
              "table": null
            },
            {
              "key": "p12_f003_oq_operational_qualification",
              "label": "OQ (Operational Qualification)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Richiesta"
              ],
              "table": null
            },
            {
              "key": "p12_f004_pq_performance_qualification",
              "label": "PQ (Performance Qualification)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Richiesta"
              ],
              "table": null
            },
            {
              "key": "p12_f005_protocolli_validazione",
              "label": "Protocolli validazione",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Da costruttore",
                "Da cliente"
              ],
              "table": null
            },
            {
              "key": "p12_f006_supporto_validazione",
              "label": "Supporto validazione",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Richiesto",
                "Solo documentazione"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "tempi_e_budget",
      "title": "TEMPI E BUDGET",
      "pageNumber": 13,
      "sortOrder": 13,
      "sections": [
        {
          "key": "section_13_1_timeline_progetto",
          "title": "13.1 Timeline Progetto",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p13_f001_data_target_installazione",
              "label": "Data target installazione",
              "placeholder": "Data target installazione",
              "helpText": null,
              "fieldType": "DATE",
              "dataKind": "DATE",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p13_f002_data_avvio_produzione",
              "label": "Data avvio produzione",
              "placeholder": "Data avvio produzione",
              "helpText": null,
              "fieldType": "DATE",
              "dataKind": "DATE",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p13_f003_finestre_disponibili_per_installazione",
              "label": "Finestre disponibili per installazione",
              "placeholder": "Finestre disponibili per installazione",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p13_f004_fermo_produzione_programmato_dal_al",
              "label": "Fermo produzione programmato: dal al",
              "placeholder": "Fermo produzione programmato: dal al",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p13_f005_milestone_intermedie_critiche",
              "label": "Milestone intermedie critiche",
              "placeholder": "Milestone intermedie critiche",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            }
          ]
        },
        {
          "key": "section_13_2_budget_e_investimento",
          "title": "13.2 Budget e Investimento",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p13_f001_budget_disponibile",
              "label": "Budget disponibile",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "<100K",
                "100-250K",
                "250-500K",
                ">500K"
              ],
              "table": null
            },
            {
              "key": "p13_f002_investimento_approvato",
              "label": "Investimento approvato",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì",
                "In approvazione",
                "Da definire"
              ],
              "table": null
            },
            {
              "key": "p13_f003_roi_target_mesi",
              "label": "ROI target: mesi",
              "placeholder": "ROI target: mesi",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p13_f004_payback_period_accettabile_mesi",
              "label": "Payback period accettabile: mesi",
              "placeholder": "Payback period accettabile: mesi",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p13_f005_opzioni_finanziamento",
              "label": "Opzioni finanziamento",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Acquisto",
                "Leasing",
                "Noleggio"
              ],
              "table": null
            },
            {
              "key": "p13_f006_incentivi_4_0_transizione_5_0",
              "label": "Incentivi 4.0/Transizione 5.0",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Da sfruttare",
                "Non applicabile"
              ],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "documentazione_e_allegati",
      "title": "DOCUMENTAZIONE E ALLEGATI",
      "pageNumber": 14,
      "sortOrder": 14,
      "sections": [
        {
          "key": "main",
          "title": "DOCUMENTAZIONE E ALLEGATI",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p14_f001_planimetria_stabilimento_scala_e_quotata",
              "label": "Planimetria stabilimento, scala e quotata",
              "placeholder": "Planimetria stabilimento, scala e quotata",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": true,
              "sortOrder": 1,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f002_layout_area_di_installazione",
              "label": "Layout area di installazione",
              "placeholder": "Layout area di installazione",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f003_fotografie_area",
              "label": "Fotografie area",
              "placeholder": "Fotografie area",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f004_scheda_tecnica_prodotto_componente",
              "label": "Scheda tecnica prodotto/componente",
              "placeholder": "Scheda tecnica prodotto/componente",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f005_disegni_tecnici_2d_3d_prodotto",
              "label": "Disegni tecnici 2D/3D prodotto",
              "placeholder": "Disegni tecnici 2D/3D prodotto",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f006_campioni_fisici_prodotto_se_disponibili",
              "label": "Campioni fisici prodotto, se disponibili",
              "placeholder": "Campioni fisici prodotto, se disponibili",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f007_specifiche_qualita_e_tolleranze",
              "label": "Specifiche qualità e tolleranze",
              "placeholder": "Specifiche qualità e tolleranze",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f008_ciclo_di_lavoro_attuale_flow_chart",
              "label": "Ciclo di lavoro attuale, flow chart",
              "placeholder": "Ciclo di lavoro attuale, flow chart",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f009_dati_produttivi_storici",
              "label": "Dati produttivi storici",
              "placeholder": "Dati produttivi storici",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 9,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f010_report_analisi_criticita",
              "label": "Report analisi criticita",
              "placeholder": "Report analisi criticita",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 10,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f011_video_processo_attuale",
              "label": "Video processo attuale",
              "placeholder": "Video processo attuale",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 11,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f012_schemi_elettrici_area",
              "label": "Schemi elettrici area",
              "placeholder": "Schemi elettrici area",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 12,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f013_documentazione_macchine_esistenti_da_integrare",
              "label": "Documentazione macchine esistenti da integrare",
              "placeholder": "Documentazione macchine esistenti da integrare",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 13,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f014_standard_aziendali_plc_hmi_sicurezza",
              "label": "Standard aziendali, PLC, HMI, sicurezza",
              "placeholder": "Standard aziendali, PLC, HMI, sicurezza",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 14,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f015_normative_specifiche_applicabili",
              "label": "Normative specifiche applicabili",
              "placeholder": "Normative specifiche applicabili",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 15,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f016_policy_aziendali_cybersecurity_cliente_nis2_accessi_gestione_incidenti",
              "label": "Policy aziendali cybersecurity Cliente, NIS2, accessi, gestione incidenti",
              "placeholder": "Policy aziendali cybersecurity Cliente, NIS2, accessi, gestione incidenti",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": true,
              "sortOrder": 16,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f017_schema_rete_ot_lista_asset_plc_hmi_switch_e_regole_firewall_esistenti",
              "label": "Schema rete OT, lista asset PLC/HMI/switch e regole firewall esistenti",
              "placeholder": "Schema rete OT, lista asset PLC/HMI/switch e regole firewall esistenti",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": false,
              "sortOrder": 17,
              "options": [],
              "table": null
            },
            {
              "key": "p14_f018_registro_modelli_ai_esistenti_del_cliente_in_caso_di_interconnessione_riuso",
              "label": "Registro modelli AI esistenti del Cliente, in caso di interconnessione/riuso",
              "placeholder": "Registro modelli AI esistenti del Cliente, in caso di interconnessione/riuso",
              "helpText": null,
              "fieldType": "BOOLEAN",
              "dataKind": "BOOLEAN",
              "required": false,
              "indexed": true,
              "sortOrder": 18,
              "options": [],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "cybersecurity_ot_conformita_nis2_dir_ue_2022_2555",
      "title": "CYBERSECURITY OT - CONFORMITÀ NIS2 (Dir. UE 2022/2555)",
      "pageNumber": 15,
      "sortOrder": 15,
      "sections": [
        {
          "key": "section_16_1_inquadramento_del_cliente_rispetto_a_nis2",
          "title": "16.1 Inquadramento del Cliente rispetto a NIS2",
          "description": null,
          "sortOrder": 2,
          "fields": [
            {
              "key": "p16_f001_il_cliente_rientra_nell_ambito_nis2",
              "label": "Il Cliente rientra nell'ambito NIS2",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": true,
              "sortOrder": 1,
              "options": [
                "Soggetto essenziale",
                "Soggetto importante",
                "Non rientra",
                "Da verificare"
              ],
              "table": null
            },
            {
              "key": "p16_f002_settore_di_appartenenza_all_i_ii_dir_ue_2022_2555",
              "label": "Settore di appartenenza (All. I/II Dir. UE 2022/2555)",
              "placeholder": "Settore di appartenenza (All. I/II Dir. UE 2022/2555)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f003_registrazione_presso_acn_effettuata",
              "label": "Registrazione presso ACN effettuata",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Sì",
                "No",
                "Non applicabile"
              ],
              "table": null
            },
            {
              "key": "p16_f004_referente_cybersecurity_cliente_nome_ruolo",
              "label": "Referente Cybersecurity Cliente (nome/ruolo)",
              "placeholder": "Referente Cybersecurity Cliente (nome/ruolo)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": true,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f005_politiche_standard_interni_applicati",
              "label": "Politiche/standard interni applicati",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "ISO/IEC 27001",
                "IEC 62443",
                "NIST CSF",
                "Altro"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_16_2_architettura_di_rete_ot",
          "title": "16.2 Architettura di rete OT",
          "description": null,
          "sortOrder": 3,
          "fields": [
            {
              "key": "p16_f001_segregazione_rete_ot_it",
              "label": "Segregazione rete OT/IT",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "VLAN dedicata",
                "Firewall industriale",
                "DMZ",
                "Rete piatta, assente"
              ],
              "table": null
            },
            {
              "key": "p16_f002_architettura_di_riferimento_purdue_model",
              "label": "Architettura di riferimento (Purdue Model)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Adottata",
                "Parziale",
                "Non adottata"
              ],
              "table": null
            },
            {
              "key": "p16_f003_vlan_subnet_assegnata_alla_nuova_macchina",
              "label": "VLAN/subnet assegnata alla nuova macchina",
              "placeholder": "VLAN/subnet assegnata alla nuova macchina",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f004_regole_firewall_richieste_porte_protocolli_ingresso_uscita",
              "label": "Regole firewall richieste (porte/protocolli ingresso/uscita)",
              "placeholder": "Regole firewall richieste (porte/protocolli ingresso/uscita)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f005_wireless_ammesso_in_area_ot",
              "label": "Wireless ammesso in area OT",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Sì",
                "No",
                "Solo per manutenzione",
                "Standard"
              ],
              "table": null
            },
            {
              "key": "p16_f006_suddivisione_in_zone_e_conduit_iec_62443_3_2",
              "label": "Suddivisione in zone e conduit (IEC 62443-3-2)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Definite dal Cliente",
                "Da definire con FG Automazioni",
                "Non applicato"
              ],
              "table": null
            },
            {
              "key": "p16_f007_security_level_sl_target_della_zona_macchina_iec_62443",
              "label": "Security Level (SL) target della zona macchina (IEC 62443)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [
                "SL1",
                "SL2",
                "SL3",
                "SL4",
                "Non specificato"
              ],
              "table": null
            },
            {
              "key": "p16_f008_switch_di_rete_ot",
              "label": "Switch di rete OT",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [
                "Managed, port security, 802.1X, VLAN tagging",
                "Unmanaged",
                "Marca/modello"
              ],
              "table": null
            },
            {
              "key": "p16_f009_nat_port_forwarding_tra_rete_ot_e_it",
              "label": "NAT / port-forwarding tra rete OT e IT",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 9,
              "options": [
                "Configurato",
                "Non consentito, data diode/proxy",
                "Da definire"
              ],
              "table": null
            },
            {
              "key": "p16_f010_bus_di_campo_industriali_presenti",
              "label": "Bus di campo industriali presenti",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 10,
              "options": [
                "PROFINET",
                "EtherCAT",
                "EtherNet/IP",
                "Modbus TCP",
                "Altro"
              ],
              "table": null
            },
            {
              "key": "p16_f011_sistema_di_rilevamento_anomalie_di_rete_ids_nids_industriale_es_claroty_nozomi_t",
              "label": "Sistema di rilevamento anomalie di rete (IDS/NIDS industriale, es. Claroty, Nozomi, Tenable.OT)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 11,
              "options": [
                "Presente",
                "In valutazione",
                "Assente",
                "Specificare"
              ],
              "table": null
            },
            {
              "key": "p16_f012_servizi_dns_ntp_dhcp_utilizzati_dalla_macchina",
              "label": "Servizi DNS/NTP/DHCP utilizzati dalla macchina",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 12,
              "options": [
                "Server interni Cliente",
                "Server di zona OT dedicati",
                "Solo locali macchina"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_16_3_identita_accessi_e_accesso_remoto",
          "title": "16.3 Identità, accessi e accesso remoto",
          "description": null,
          "sortOrder": 4,
          "fields": [
            {
              "key": "p16_f001_active_directory_identity_provider_cliente",
              "label": "Active Directory / Identity Provider Cliente",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": true,
              "sortOrder": 1,
              "options": [
                "Da integrare con HMI/SCADA",
                "Account locali",
                "Misto"
              ],
              "table": null
            },
            {
              "key": "p16_f002_autenticazione_multi_fattore_mfa_richiesta",
              "label": "Autenticazione multi-fattore (MFA) richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Sì, per accesso remoto",
                "Sì, anche locale",
                "No"
              ],
              "table": null
            },
            {
              "key": "p16_f003_politica_password_lunghezza_scadenza_complessita",
              "label": "Politica password (lunghezza, scadenza, complessita)",
              "placeholder": "Politica password (lunghezza, scadenza, complessita)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f004_modalita_accesso_remoto_fg_automazioni_autorizzata",
              "label": "Modalita accesso remoto FG Automazioni autorizzata",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "VPN Cliente",
                "Jump host",
                "Router industriale, TeamViewer IoT, Ewon, Siemens SINEMA, ecc.",
                "Non consentito"
              ],
              "table": null
            },
            {
              "key": "p16_f005_logging_accessi_remoti_e_locali",
              "label": "Logging accessi remoti e locali",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Richiesto su SIEM Cliente",
                "Locale su HMI/PLC",
                "Non richiesto"
              ],
              "table": null
            },
            {
              "key": "p16_f006_profili_utente_rbac_su_hmi_scada_da_implementare",
              "label": "Profili utente RBAC su HMI/SCADA da implementare",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [
                "Operatore, solo lettura/avvio",
                "Manutentore, parametri di processo",
                "Admin, configurazione",
                "Service FG Automazioni"
              ],
              "table": null
            },
            {
              "key": "p16_f007_account_di_servizio_macchina_plc_drives_iot_gateway",
              "label": "Account di servizio macchina (PLC, drives, IoT gateway)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [
                "Modifica password di default obbligatoria al collaudo",
                "Vault credenziali Cliente",
                "Consegna in busta sigillata"
              ],
              "table": null
            },
            {
              "key": "p16_f008_gestione_personale_fg_automazioni_in_sito_badge_scorta_nda",
              "label": "Gestione personale FG Automazioni in sito, badge, scorta, NDA",
              "placeholder": "Gestione personale FG Automazioni in sito, badge, scorta, NDA",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f009_tracciamento_sessioni_di_teleassistenza",
              "label": "Tracciamento sessioni di teleassistenza",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 9,
              "options": [
                "Approvazione preventiva del Cliente per ogni sessione",
                "Registrazione video/log della sessione",
                "Solo log connessione"
              ],
              "table": null
            },
            {
              "key": "p16_f010_time_out_automatico_sessioni_hmi_inattive",
              "label": "Time-out automatico sessioni HMI inattive",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 10,
              "options": [
                "5 min",
                "15 min",
                "Custom",
                "Disabilitato, con giustificazione"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_16_4_hardening_dei_componenti_e_gestione_vulnerabilità",
          "title": "16.4 Hardening dei componenti e gestione vulnerabilità",
          "description": null,
          "sortOrder": 5,
          "fields": [
            {
              "key": "p16_f001_hardening_os_pc_industriali_hmi_edge_vision",
              "label": "Hardening OS PC industriali (HMI/Edge/Vision)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "Disabilitazione USB",
                "Whitelisting applicazioni",
                "Antivirus/EDR",
                "Standard"
              ],
              "table": null
            },
            {
              "key": "p16_f002_patch_management_os_e_firmware_plc_drives_switch",
              "label": "Patch management OS e firmware (PLC, drives, switch)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "A carico Cliente",
                "A carico FG Automazioni",
                "Da definire in contratto SLA"
              ],
              "table": null
            },
            {
              "key": "p16_f003_sbom_software_bill_of_materials_richiesta",
              "label": "SBOM (Software Bill of Materials) richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p16_f004_cifratura_comunicazioni_tls_opc_ua_sign_encrypt_vpn",
              "label": "Cifratura comunicazioni (TLS, OPC UA Sign&Encrypt, VPN)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Richiesta",
                "Non necessaria"
              ],
              "table": null
            },
            {
              "key": "p16_f005_inventario_asset_ot_da_consegnare_plc_hmi_drives_switch_gateway",
              "label": "Inventario asset OT da consegnare (PLC, HMI, drives, switch, gateway)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Standard, marca/modello/firmware",
                "Esteso, CVE/EOL/fornitore/criticita"
              ],
              "table": null
            },
            {
              "key": "p16_f006_asset_critici_identificati_come_key_components_art_21_dir_nis2",
              "label": "Asset critici identificati come \"key components\" (Art. 21 Dir. NIS2)",
              "placeholder": "Asset critici identificati come \"key components\" (Art. 21 Dir. NIS2)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f007_disabilitazione_protocolli_servizi_non_utilizzati_telnet_ftp_snmp_v1_v2_http_in_",
              "label": "Disabilitazione protocolli/servizi non utilizzati (Telnet, FTP, SNMP v1/v2, HTTP in chiaro)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [
                "Standard al collaudo",
                "Eccezioni motivate"
              ],
              "table": null
            },
            {
              "key": "p16_f008_gestione_media_rimovibili_usb_schede_sd",
              "label": "Gestione media rimovibili (USB, schede SD)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 8,
              "options": [
                "Porte fisicamente disabilitate",
                "Stazione di sanitizzazione USB Cliente",
                "Whitelist dispositivi",
                "Libero, sconsigliato"
              ],
              "table": null
            },
            {
              "key": "p16_f009_vulnerability_scan_penetration_test_pre_collaudo",
              "label": "Vulnerability scan / penetration test pre-collaudo",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 9,
              "options": [
                "Richiesto a FG Automazioni",
                "Eseguito da terza parte Cliente",
                "Non richiesto"
              ],
              "table": null
            },
            {
              "key": "p16_f010_sincronizzazione_orologi_ntp_per_coerenza_dei_log",
              "label": "Sincronizzazione orologi (NTP) per coerenza dei log",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 10,
              "options": [
                "Server NTP Cliente",
                "Internet, pool.ntp.org",
                "Locale RTC PLC"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_16_5_backup_ripristino_e_continuita_operativa",
          "title": "16.5 Backup, ripristino e continuità operativa",
          "description": null,
          "sortOrder": 6,
          "fields": [
            {
              "key": "p16_f001_backup_programmi_plc_hmi_scada",
              "label": "Backup programmi PLC/HMI/SCADA",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [
                "A carico FG Automazioni, consegna",
                "Backup periodico a carico Cliente",
                "Servizio gestito FG, SLA"
              ],
              "table": null
            },
            {
              "key": "p16_f002_frequenza_backup_richiesta",
              "label": "Frequenza backup richiesta",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Giornaliera",
                "Settimanale",
                "Mensile",
                "Solo a fronte di modifiche"
              ],
              "table": null
            },
            {
              "key": "p16_f003_rto_recovery_time_objective",
              "label": "RTO (Recovery Time Objective)",
              "placeholder": "RTO (Recovery Time Objective)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f004_rpo_recovery_point_objective",
              "label": "RPO (Recovery Point Objective)",
              "placeholder": "RPO (Recovery Point Objective)",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f005_test_ripristino_periodico_previsto",
              "label": "Test ripristino periodico previsto",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [
                "Sì",
                "No",
                "Frequenza"
              ],
              "table": null
            }
          ]
        },
        {
          "key": "section_16_6_gestione_incidenti_e_responsabilita_art_23_dir_nis2",
          "title": "16.6 Gestione incidenti e responsabilità (Art. 23 Dir. NIS2)",
          "description": null,
          "sortOrder": 7,
          "fields": [
            {
              "key": "p16_f001_procedura_segnalazione_incidenti_del_cliente_fornita_a_fg_automazioni",
              "label": "Procedura segnalazione incidenti del Cliente fornita a FG Automazioni",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": true,
              "sortOrder": 1,
              "options": [
                "Sì",
                "No",
                "Da fornire"
              ],
              "table": null
            },
            {
              "key": "p16_f002_tempi_di_notifica_concordati_early_warning_24h_notifica_72h",
              "label": "Tempi di notifica concordati (early warning 24h, notifica 72h)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 2,
              "options": [
                "Definiti in contratto",
                "Da definire"
              ],
              "table": null
            },
            {
              "key": "p16_f003_clausole_nis2_supply_chain_security_previste_in_contratto_art_21_lett_d",
              "label": "Clausole NIS2 / supply-chain security previste in contratto (Art. 21 lett. d)",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 3,
              "options": [
                "Sì",
                "Da inserire"
              ],
              "table": null
            },
            {
              "key": "p16_f004_risk_assessment_ot_richiesto_come_deliverable",
              "label": "Risk assessment OT richiesto come deliverable",
              "placeholder": null,
              "helpText": null,
              "fieldType": "CHECKBOX_GROUP",
              "dataKind": "JSON",
              "required": false,
              "indexed": false,
              "sortOrder": 4,
              "options": [
                "Sì",
                "No"
              ],
              "table": null
            },
            {
              "key": "p16_f005_compilato_da",
              "label": "Compilato da",
              "placeholder": "Compilato da",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 5,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f006_data",
              "label": "Data",
              "placeholder": "Data",
              "helpText": null,
              "fieldType": "DATE",
              "dataKind": "DATE",
              "required": false,
              "indexed": false,
              "sortOrder": 6,
              "options": [],
              "table": null
            },
            {
              "key": "p16_f007_firma",
              "label": "Firma",
              "placeholder": "Firma",
              "helpText": null,
              "fieldType": "TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 7,
              "options": [],
              "table": null
            }
          ]
        }
      ]
    },
    {
      "key": "note_e_osservazioni",
      "title": "NOTE E OSSERVAZIONI",
      "pageNumber": 16,
      "sortOrder": 16,
      "sections": [
        {
          "key": "main",
          "title": "NOTE E OSSERVAZIONI",
          "description": null,
          "sortOrder": 1,
          "fields": [
            {
              "key": "p15_f001_annotazioni_criticita_evidenziate_richieste_particolari",
              "label": "Annotazioni, criticita evidenziate, richieste particolari",
              "placeholder": "Annotazioni, criticita evidenziate, richieste particolari",
              "helpText": null,
              "fieldType": "LONG_TEXT",
              "dataKind": "STRING",
              "required": false,
              "indexed": false,
              "sortOrder": 1,
              "options": [],
              "table": null
            }
          ]
        }
      ]
    }
  ]
} as const satisfies ParsedFormSnapshot;
