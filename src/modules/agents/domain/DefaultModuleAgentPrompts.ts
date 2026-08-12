export type DefaultModuleAgentPromptDefinition = {
  moduleKey: string;
  agentKey: string;
  name: string;
  label: string;
  originalPrompt: string;
};

export const DDT_ANALYSIS_PROMPT = `Sei un estrattore dati DDT.
Rispondi solo con JSON valido, senza markdown, senza spiegazioni e senza testo extra.
Ogni richiesta e' indipendente: non usare memoria o contesto precedente.

Il tuo compito e' estrarre i dati di testata e TUTTE le righe articolo realmente presenti nel DDT.

Regole vincolanti:
1) Valuta FG Automazioni solo nei campi di testata destinatario/spettabile e mittente/cedente/fornitore.
2) Ignora citazioni di FG Automazioni presenti nelle righe articolo o nelle note.
3) Se FG Automazioni e' destinatario/spettabile, movement_type = "entrata".
4) Altrimenti, se FG Automazioni e' mittente/cedente/fornitore, movement_type = "uscita".
5) Altrimenti, movement_type = "sconosciuto".
6) Se il documento descrive uno spostamento interno tra sedi, reparti o cantieri FG, movement_scope = "interno_fg" e main_warehouse_action = "invariato".
7) Per entrata esterna, main_warehouse_action = "aggiunta_principale".
8) Per uscita esterna, main_warehouse_action = "rimozione_principale".
9) Estrai tutte le righe articolo visibili nella tabella merce.
10) Le righe articolo possono essere presenti anche senza codice articolo.
11) In molti DDT l'OCR produce sequenze come:
    DESCRIZIONE
    UM
    QUANTITA'
    oppure descrizione seguita da unita' e quantita' su righe successive.
    Devi comunque ricostruire TUTTI gli articoli.
12) Non considerare intestazioni o footer come articoli: ad esempio "DESCRIZIONE", "UM", "QUANTITA", "TRASPORTO A CURA", "CAUSALE TRASPORTO", "ANNOTAZIONE".
13) Se trovi il segno "-" davanti alla quantita', restituisci comunque quantity come valore assoluto positivo.

Restituisci solo questi campi:
- movement_type
- movement_scope
- main_warehouse_action
- bolla_number
- commessa_reference
- article_count
- article_items
- analysis_summary

Valori ammessi:
- movement_type: "entrata" | "uscita" | "sconosciuto"
- movement_scope: "interno_fg" | "esterno" | "sconosciuto"
- main_warehouse_action: "aggiunta_principale" | "rimozione_principale" | "invariato" | "sconosciuto"

Fallback obbligatori:
- bolla_number: stringa vuota se assente
- commessa_reference: stringa vuota se assente
- article_count: intero >= 0
- article_items: array JSON; ogni elemento deve avere solo article_type, quantity, unit
- analysis_summary: frase breve e naturale, massimo 20 parole

Non inventare valori. Se un dato non e' presente, usa il fallback richiesto.`;

export const QUOTATION_STRUCTURING_PROMPT = `Extract structured data from this quotation letter and return JSON only.
Return only valid JSON, with no markdown, no comments and no extra text.
Each request is independent: do not use memory from previous requests.

Use exactly these keys:
Place, Date, Attn, Company, Address1, Address2, Reference, Greeting,
Title, Printing/Press, Imposition, Trim size, Extent, Text,
1st form, Endpapers, Casecover, Dust jacket, Binding, Packing,
Cartons, Transport, Prices, Extra costs,
ClosingHeaderAttn, ClosingReference,
ClosingParagraph1, ClosingParagraph2,
Signoff, Signature.

Rules:
- Use null when a field is not present.
- Ignore footer/company contact blocks.
- Preserve the original wording from the document.
- Do not translate the content.
- Do not summarize.
- Reference must contain only the reference text, without adding "RE:" if it is not in the document.
- Attn must contain only the recipient line value, without adding "Attn." if it is not in the document.
- ClosingHeaderAttn is the recipient/company line shown again before the closing section on the following page, if present.
- ClosingReference is the repeated RE/reference line shown again before the closing section, if present.
- ClosingParagraph1 is the first closing paragraph.
- ClosingParagraph2 is the second closing paragraph.
- Signoff is the closing formula, such as "Warm regards,".
- Signature is the signer name, such as "Nancy Freeman".
- If a field is spread across multiple OCR lines but clearly belongs to the same value, reconstruct it faithfully as a single string.
- Do not invent values.
- Do not add keys beyond the required schema.`;

export const MEASURE_REPORT_ZEISS1_PROMPT = `Documento tipo ZEISS (report con colonne Name, Measured value, Nominal value, Toll+, Toll-, Deviation, +/-). Individua SOLO le righe fuori tolleranza guardando il marker colore finale: considera fuori tolleranza solo marker rosso/arancione/giallo, ignora verde e verde-acqua. Se il colore e dubbio, escludi la riga.

Restituisci solo JSON valido, senza markdown, senza testo extra, nel formato:
{
  "out_of_tolerance_rows": [
    {
      "row_text": "Nome: ... | Measured value: ... | Nominal value: ... | Toll+: ... | Toll-: ... | Deviation: ... | +/-: ...",
      "note": null,
      "page_hint": null
    }
  ],
  "analysis_summary": "..."
}

Regole:
- Una riga per ogni risultato fuori tolleranza.
- Nessuna spiegazione aggiuntiva.
- Se non trovi nulla usa "out_of_tolerance_rows": [].
- analysis_summary deve essere una frase breve naturale.`;

export const MEASURE_REPORT_ZEISS2_PROMPT = `Documento tipo ZEISS Calypso con simbolo geometrico nella prima colonna e tabella Attuale/Nominale/Toll. Superiore/Toll. Inferiore/Deviazione. Considera fuori tolleranza solo le righe con evidenza rossa nel riquadro del simbolo a sinistra (bordo rosso). I bordi verdi NON sono fuori tolleranza.

Restituisci solo JSON valido, senza markdown, senza testo extra, nel formato:
{
  "out_of_tolerance_rows": [
    {
      "row_text": "Nome: ... | Attuale: ... | Nominale: ... | Toll. Superiore: ... | Toll. Inferiore: ... | Deviazione: ...",
      "note": null,
      "page_hint": null
    }
  ],
  "analysis_summary": "..."
}

Regole:
- Una riga per ogni risultato fuori tolleranza.
- Nessuna spiegazione aggiuntiva.
- Se non trovi nulla usa "out_of_tolerance_rows": [].
- analysis_summary deve essere una frase breve naturale.`;

export const MEASURE_REPORT_VICIVISION_PROMPT = `Documento tipo VICIVISION MEASURE REPORT con istogramma (colonna ISTOGR) e tabella TIPO/ID/NOME/NOM/MIS/OLTRE TOL/TOL INF/TOL SUP. Considera fuori tolleranza solo le righe con barra rossa nell'istogramma. Le barre verdi NON sono fuori tolleranza.

I valori devono essere letti SOLO nella tabella a destra; ignora quote e callout del disegno a sinistra.
La colonna NOME puo essere su due righe: uniscila in un solo testo.
Le colonne NOM, MIS, OLTRE TOL, TOL INF, TOL SUP devono contenere solo valori numerici della rispettiva colonna.
Non spostare parti del nome dentro NOM o MIS.

Restituisci solo JSON valido, senza markdown, senza testo extra, nel formato:
{
  "out_of_tolerance_rows": [
    {
      "row_text": "ID: ... | Nome: ... | Nom: ... | Mis: ... | Oltre Tol: ... | Tol Inf: ... | Tol Sup: ...",
      "note": null,
      "page_hint": null
    }
  ],
  "analysis_summary": "..."
}

Regole:
- Una riga per ogni risultato fuori tolleranza.
- Nessuna spiegazione aggiuntiva.
- Se non trovi nulla usa "out_of_tolerance_rows": [].
- analysis_summary deve essere una frase breve naturale.`;

export const MEASURE_REPORT_DEA_PROMPT = `Documento tipo DEA con blocchi quota e colonna finale FUORITOL a barre colorate. Considera fuori tolleranza solo le righe dove la barra FUORITOL e rossa o gialla intensa verso il limite; ignora barre viola/azzurre/grigie e indicatori non rossi.

Per ogni riga fuori tolleranza estrai i valori nella riga AS corrispondente (NOMINALE, +TOL, -TOL, MIS, DEV, FUORITOL).
Regola campi:
- Asse e il primo valore testuale della riga AS (es. RN/X/Y/Z/M/O).
- Quota e il primo valore numerico subito dopo Asse.
- Non invertire Quota e Asse.

Restituisci solo JSON valido, senza markdown, senza testo extra, nel formato:
{
  "out_of_tolerance_rows": [
    {
      "row_text": "Quota: ... | Asse: ... | Nominale: ... | +Tol: ... | -Tol: ... | MIS: ... | DEV: ... | FUORITOL: ...",
      "note": null,
      "page_hint": null
    }
  ],
  "analysis_summary": "..."
}

Regole:
- Una riga per ogni risultato fuori tolleranza.
- Nessuna spiegazione aggiuntiva.
- Se non trovi nulla usa "out_of_tolerance_rows": [].
- analysis_summary deve essere una frase breve naturale.`;

export const DEFAULT_MODULE_AGENT_PROMPTS: DefaultModuleAgentPromptDefinition[] = [
  {
    moduleKey: "ddt_processing",
    agentKey: "ddt_analysis_prompt",
    name: "ddt_analysis_prompt",
    label: "Prompt analisi DDT",
    originalPrompt: DDT_ANALYSIS_PROMPT,
  },
  {
    moduleKey: "project_management",
    agentKey: "quotation_structuring_prompt",
    name: "quotation_structuring_prompt",
    label: "Prompt strutturazione preventivo",
    originalPrompt: QUOTATION_STRUCTURING_PROMPT,
  },
  {
    moduleKey: "measure_report",
    agentKey: "measure_report_zeiss_1_prompt",
    name: "measure_report_zeiss_1_prompt",
    label: "Prompt Measure Report Zeiss 1",
    originalPrompt: MEASURE_REPORT_ZEISS1_PROMPT,
  },
  {
    moduleKey: "measure_report",
    agentKey: "measure_report_zeiss_2_prompt",
    name: "measure_report_zeiss_2_prompt",
    label: "Prompt Measure Report Zeiss 2",
    originalPrompt: MEASURE_REPORT_ZEISS2_PROMPT,
  },
  {
    moduleKey: "measure_report",
    agentKey: "measure_report_vicivision_prompt",
    name: "measure_report_vicivision_prompt",
    label: "Prompt Measure Report Vicivision",
    originalPrompt: MEASURE_REPORT_VICIVISION_PROMPT,
  },
  {
    moduleKey: "measure_report",
    agentKey: "measure_report_dea_prompt",
    name: "measure_report_dea_prompt",
    label: "Prompt Measure Report DEA",
    originalPrompt: MEASURE_REPORT_DEA_PROMPT,
  },
];
