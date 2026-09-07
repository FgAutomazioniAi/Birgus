import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  CommissionDataKind,
  CommissionFieldSensitivity,
  CommissionFieldType,
  CommissionTemplateScope,
  CommissionTemplateVersionStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { COMMISSION_INTAKE_TEMPLATE_SNAPSHOT } from "./commission-intake-template-snapshot.js";

const TEMPLATE_IDENTITY_KEY = "system:commission_intake_standard";
const TEMPLATE_KEY = "commission_intake_standard";
const FORM_SOURCE_RELATIVE_PATH = "Obsidian/Birgus data/Drafts/INFORMAZIONI GENERALI PROGETTO.md";

const LEGACY_GENERAL_FIELD_KEYS = [
  "general_commission_number",
  "general_customer",
  "general_project_description",
  "general_customer_technical_contact",
  "general_site_visit_date",
  "general_plant",
  "general_department_line",
  "general_fg_representative",
] as const;

const FALLBACK_PAGE_TITLES = [
  "INFORMAZIONI GENERALI PROGETTO",
  "PROCESSO PRODUTTIVO ATTUALE",
  "PRODOTTO/COMPONENTE DA LAVORARE",
  "OBIETTIVI E REQUISITI AUTOMAZIONE",
  "SPAZIO E LAYOUT DISPONIBILE",
  "UTILITIES E INFRASTRUTTURE",
  "CONTROLLO,SUPERVISIONE E INTEGRAZIONE IT",
  "VISIONE ARTIFICIALE E INTELLIGENZA ARTIFICIALE",
  "ROBOTICA E MANIPOLAZIONE",
  "SICUREZZA E NORMATIVE",
  "MANUTENZIONE E ASSISTENZA",
  "COLLAUDO E VALIDAZIONE",
  "TEMPI E BUDGET",
  "CYBERSECURITY OT - CONFORMITÀ NIS2 (Dir. UE 2022/2555)",
  "DOCUMENTAZIONE E ALLEGATI",
  "NOTE E OSSERVAZIONI",
] as const;

type ParsedTableColumn = {
  key: string;
  label: string;
  placeholder: string | null;
  dataKind: CommissionDataKind;
  required: boolean;
  sortOrder: number;
};

type ParsedField = {
  key: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  fieldType: CommissionFieldType;
  dataKind: CommissionDataKind;
  required: boolean;
  indexed: boolean;
  sortOrder: number;
  options: string[];
  table: {
    columns: ParsedTableColumn[];
    defaultRows: Array<Record<string, string>>;
  } | null;
};

type ParsedSection = {
  key: string;
  title: string;
  description: string | null;
  sortOrder: number;
  fields: ParsedField[];
};

type ParsedPage = {
  key: string;
  title: string;
  pageNumber: number;
  sortOrder: number;
  sections: ParsedSection[];
};

type ParsedForm = {
  sourcePath: string;
  sourceHash: string;
  pages: ParsedPage[];
};

export type ParsedFormSnapshot = ParsedForm;

type TableDraft = {
  title: string;
  required: boolean;
  columns: ParsedTableColumn[];
  rows: string[][];
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const normalizeComparable = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const pageTitleIndex = new Map(FALLBACK_PAGE_TITLES.map((title) => [normalizeComparable(title), title]));
const pageSortOrder = new Map(FALLBACK_PAGE_TITLES.map((title, index) => [normalizeComparable(title), index + 1]));

export async function ensureCommissionIntakeSystemTemplate(prisma: PrismaClient): Promise<void> {
  const parsedForm = loadCommissionIntakeForm();
  const template = await prisma.commissionFormTemplate.upsert({
    where: { identity_key: TEMPLATE_IDENTITY_KEY },
    update: {
      key: TEMPLATE_KEY,
      name: "Checklist raccolta dati",
      description: "Template standard per raccolta dati a step finalizzata alla generazione commesse.",
      scope: CommissionTemplateScope.SYSTEM,
      is_active: true,
      deleted_at: null,
    },
    create: {
      workspace_id: null,
      key: TEMPLATE_KEY,
      identity_key: TEMPLATE_IDENTITY_KEY,
      name: "Checklist raccolta dati",
      description: "Template standard per raccolta dati a step finalizzata alla generazione commesse.",
      scope: CommissionTemplateScope.SYSTEM,
      is_active: true,
    },
  });

  const version = await prisma.commissionFormVersion.upsert({
    where: {
      template_id_version: {
        template_id: template.id,
        version: 1,
      },
    },
    update: {
      status: CommissionTemplateVersionStatus.PUBLISHED,
      title: "Checklist raccolta dati v1",
      schema_json: {
        source: parsedForm.sourcePath,
        sourceHash: parsedForm.sourceHash,
        pages: parsedForm.pages.map((page) => page.title),
      },
      published_at: new Date(),
      retired_at: null,
    },
    create: {
      workspace_id: null,
      template_id: template.id,
      version: 1,
      status: CommissionTemplateVersionStatus.PUBLISHED,
      title: "Checklist raccolta dati v1",
      schema_json: {
        source: parsedForm.sourcePath,
        sourceHash: parsedForm.sourceHash,
        pages: parsedForm.pages.map((page) => page.title),
      },
      published_at: new Date(),
    },
  });

  const existingPages = await detachExistingPagesForSync(prisma, version.id);

  for (const pageDefinition of parsedForm.pages) {
    const existingPage = existingPages.get(pageDefinition.key);
    const page = existingPage
      ? await prisma.commissionFormPage.update({
        where: { id: existingPage.id },
        data: {
          key: pageDefinition.key,
          page_number: pageDefinition.pageNumber,
          title: pageDefinition.title,
          description: null,
          sort_order: pageDefinition.sortOrder,
        },
      })
      : await prisma.commissionFormPage.create({
        data: {
          workspace_id: null,
          version_id: version.id,
          page_number: pageDefinition.pageNumber,
          key: pageDefinition.key,
          title: pageDefinition.title,
          sort_order: pageDefinition.sortOrder,
        },
      });

    for (const sectionDefinition of pageDefinition.sections) {
      const section = await prisma.commissionFormSection.upsert({
        where: {
          page_id_key: {
            page_id: page.id,
            key: sectionDefinition.key,
          },
        },
        update: {
          title: sectionDefinition.title,
          description: sectionDefinition.description,
          sort_order: sectionDefinition.sortOrder,
        },
        create: {
          workspace_id: null,
          page_id: page.id,
          key: sectionDefinition.key,
          title: sectionDefinition.title,
          description: sectionDefinition.description,
          sort_order: sectionDefinition.sortOrder,
        },
      });

      for (const fieldDefinition of sectionDefinition.fields) {
        await upsertField(prisma, version.id, page.id, section.id, fieldDefinition);
      }
    }

    const desiredSectionKeys = pageDefinition.sections.map((section) => section.key);
    await prisma.commissionFormSection.deleteMany({
      where: {
        page_id: page.id,
        key: { notIn: desiredSectionKeys },
        fields: { none: {} },
      },
    });
  }

  await pruneObsoleteTemplateShape(
    prisma,
    version.id,
    new Set(parsedForm.pages.flatMap((page) => page.sections.flatMap((section) => section.fields.map((field) => field.key)))),
  );
}

async function detachExistingPagesForSync(
  prisma: PrismaClient,
  versionId: string,
): Promise<Map<string, { id: string }>> {
  const pages = await prisma.commissionFormPage.findMany({
    where: { version_id: versionId },
    select: { id: true, key: true },
    orderBy: { sort_order: "asc" },
  });

  for (const [index, page] of pages.entries()) {
    await prisma.commissionFormPage.update({
      where: { id: page.id },
      data: {
        key: `__sync_${index + 1}_${page.id.replace(/-/g, "_")}`,
        page_number: 1000 + index,
        sort_order: 1000 + index,
      },
    });
  }

  return new Map(pages.map((page) => [page.key, { id: page.id }]));
}

async function pruneObsoleteTemplateShape(
  prisma: PrismaClient,
  versionId: string,
  desiredFieldKeys: Set<string>,
): Promise<void> {
  await prisma.commissionFormField.deleteMany({
    where: {
      version_id: versionId,
      key: { notIn: [...desiredFieldKeys] },
      values: { none: {} },
      table_cells: { none: {} },
    },
  });

  await prisma.commissionFormField.updateMany({
    where: {
      version_id: versionId,
      key: { notIn: [...desiredFieldKeys] },
      section_id: { not: null },
      OR: [
        { values: { some: {} } },
        { table_cells: { some: {} } },
      ],
    },
    data: {
      section_id: null,
      sort_order: 999_999,
    },
  });

  await prisma.commissionFormSection.deleteMany({
    where: {
      page: { version_id: versionId },
      fields: { none: {} },
    },
  });
}

function loadCommissionIntakeForm(): ParsedForm {
  if (process.env.BIRGUS_COMMISSION_TEMPLATE_SOURCE !== "markdown") {
    return prepareCommissionIntakeForm(COMMISSION_INTAKE_TEMPLATE_SNAPSHOT);
  }

  const sourcePath = resolve(process.cwd(), FORM_SOURCE_RELATIVE_PATH);
  if (!existsSync(sourcePath)) {
    return prepareCommissionIntakeForm(COMMISSION_INTAKE_TEMPLATE_SNAPSHOT);
  }

  const source = readFileSync(sourcePath, "utf8");
  return prepareCommissionIntakeForm({
    sourcePath: FORM_SOURCE_RELATIVE_PATH,
    sourceHash: createHash("sha256").update(source).digest("hex"),
    pages: parseCommissionIntakeForm(source),
  });
}

function prepareCommissionIntakeForm(form: ParsedForm): ParsedForm {
  const prepared: ParsedForm = {
    ...form,
    pages: form.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => ({
          ...field,
          required: false,
          table: field.table
            ? {
              ...field.table,
              columns: field.table.columns.map((column) => ({ ...column, required: false })),
            }
            : null,
        })),
      })),
    })),
  };

  orderCommissionIntakePages(prepared);
  applyCommissionIntakeTemplateCorrections(prepared);
  ensureUniqueFieldKeys(prepared);
  return prepared;
}

function orderCommissionIntakePages(form: ParsedForm): void {
  form.pages.sort((left, right) => {
    const leftOrder = pageSortOrder.get(normalizeComparable(left.title)) ?? left.sortOrder;
    const rightOrder = pageSortOrder.get(normalizeComparable(right.title)) ?? right.sortOrder;
    return leftOrder - rightOrder;
  });
  form.pages.forEach((page, index) => {
    page.pageNumber = index + 1;
    page.sortOrder = index + 1;
  });
}

function applyCommissionIntakeTemplateCorrections(form: ParsedForm): void {
  const page3 = findPage(form, 3);
  const section33 = findSection(page3, "3.3 ");
  setField(section33, "Normative di riferimento", {
    label: "Normative di riferimento",
    placeholder: "(es. ISO, CE, FDA)",
  });
  setField(section33, "Campionamento", {
    label: "Campionamento: pezzi",
    placeholder: null,
  });

  const page4 = findPage(form, 4);
  const section42 = findSection(page4, "4.2 ");
  if (section42) {
    section42.title = "4.2 Operazioni da Automatizzare";
    section42.fields = [buildAutomationOperationsField()];
  }

  const page5 = findPage(form, 5);
  const section51 = findSection(page5, "5.1 ");
  setField(section51, "Planimetria allegata", {
    fieldType: CommissionFieldType.SELECT,
    dataKind: CommissionDataKind.STRING,
    placeholder: null,
    options: ["Sì", "No"],
    helpText: "Carica il file corrispondente nella scheda Documentazione e allegati.",
  });
  setField(section51, "Foto area disponibili", {
    fieldType: CommissionFieldType.SELECT,
    dataKind: CommissionDataKind.STRING,
    placeholder: null,
    options: ["Sì", "No"],
    helpText: "Carica il file corrispondente nella scheda Documentazione e allegati.",
  });
  setField(section51, "Planimetria allegata e Foto area disponibili ", {
    fieldType: CommissionFieldType.SELECT,
    dataKind: CommissionDataKind.STRING,
    placeholder: null,
    options: ["Sì", "No"],
    helpText: "Carica i file corrispondenti nella scheda Documentazione e allegati.",
  });
  const page6 = findPage(form, 6);
  const section62 = findSection(page6, "6.2 ");
  replaceFieldWithFields(section62, "Qualit", [
    textField("p06_s02_qualita_aria_classe_solidi", "Qualità aria - Classe solidi"),
    textField("p06_s02_qualita_aria_acqua", "Qualità aria - Acqua"),
    textField("p06_s02_qualita_aria_olio", "Qualità aria - Olio"),
  ]);

  const section63 = findSection(page6, "6.3 ");
  replaceFieldWithFields(section63, "Aria condizionata", [
    {
      ...textField("p06_s03_aria_condizionata", "Aria condizionata"),
      fieldType: CommissionFieldType.CHECKBOX_GROUP,
      dataKind: CommissionDataKind.JSON,
      options: ["Sì", "No"],
    },
    textField("p06_s03_temperatura_min_c", "Temperatura minima: C"),
    textField("p06_s03_temperatura_max_c", "Temperatura massima: C"),
    textField("p06_s03_umidita_min_percent", "Umidità minima: %"),
    textField("p06_s03_umidita_max_percent", "Umidità massima: %"),
  ]);
  setField(section63, "Illuminazione area", {
    fieldType: CommissionFieldType.CHECKBOX_GROUP,
    dataKind: CommissionDataKind.JSON,
    placeholder: null,
    options: ["Adeguata", "Da integrare"],
  });
  insertFieldAfter(section63, "Illuminazione area", {
    key: "p06_s03_lux_illuminazione_area",
    label: "Lux",
    placeholder: null,
    helpText: null,
    fieldType: CommissionFieldType.TEXT,
    dataKind: CommissionDataKind.STRING,
    required: false,
    indexed: false,
    sortOrder: 0,
    options: [],
    table: null,
  });

  const page7 = findPage(form, 7);
  const section71 = findSection(page7, "7.1 ");
  setField(section71, "PLC esistente in plant", {
    fieldType: CommissionFieldType.CHECKBOX_GROUP,
    dataKind: CommissionDataKind.JSON,
    placeholder: null,
    options: ["Siemens", "Allen-Bradley", "Omron", "Altro"],
  });
  insertFieldAfter(section71, "PLC esistente in plant", textField("p07_s01_altro_plc_nome", "Nome PLC altro"));
  insertFieldAfter(section71, "Nome PLC altro", textField("p07_s01_plc_quantita", "Quantità PLC"));
  setField(section71, "HMI richiesto", {
    fieldType: CommissionFieldType.CHECKBOX_GROUP,
    dataKind: CommissionDataKind.JSON,
    placeholder: null,
    options: ["Touch panel locale", "PC industriale", "Entrambi"],
  });
  insertFieldAfter(section71, "HMI richiesto", textField("p07_s01_hmi_quantita", "Quantità HMI"));
  setField(section71, "Dimensione HMI preferita", {
    fieldType: CommissionFieldType.CHECKBOX_GROUP,
    dataKind: CommissionDataKind.JSON,
    placeholder: null,
    options: ["7\"", "10\"", "15\"", "21\"", "Altro"],
  });
  insertFieldAfter(section71, "Dimensione HMI preferita", textField("p07_s01_dimensione_hmi_altra", "Dimensione HMI altra"));

  const section72 = findSection(page7, "7.2 ");
  setField(section72, "VPN per assistenza remota", {
    fieldType: CommissionFieldType.CHECKBOX_GROUP,
    dataKind: CommissionDataKind.JSON,
    placeholder: null,
    options: ["Sì", "No"],
  });

  const page9 = findPage(form, 9);
  const section94 = findSection(page9, "9.4 ");
  if (section94) {
    section94.title = "9.4 Vendor List componenti";
    const vendorField = section94.fields.find((field) => field.fieldType === CommissionFieldType.TABLE);
    if (vendorField) {
      vendorField.label = "Componenti";
      vendorField.placeholder = null;
      const noteColumn = vendorField.table?.columns.find((column) => column.key === "col_5_altro");
      if (noteColumn) {
        noteColumn.label = "Note";
      }
      const rows = vendorField.table?.defaultRows ?? [];
      for (const row of rows) {
        const currentReferenceBrands = row.col_3_marche_di_riferimento;
        if (typeof currentReferenceBrands === "string" && currentReferenceBrands.trim().length > 0) {
          row._placeholder_col_3_marche_di_riferimento = currentReferenceBrands;
          row.col_3_marche_di_riferimento = "";
        }
      }
      if (vendorField.table && !rows.some((row) => row.col_1_categoria === "Altro")) {
        vendorField.table.defaultRows.push({
          col_1_categoria: "Altro",
          col_2_componente: "",
          col_3_marche_di_riferimento: "",
          _placeholder_col_3_marche_di_riferimento: "Marca o fornitore di riferimento",
          col_4_confermato: "",
          col_5_altro: "",
        });
      }
    }
  }

  const page13 = findPage(form, 13);
  const section131 = findSection(page13, "13.1 ");
  setField(section131, "Fermo produzione programmato", {
    label: "Fermo produzione programmato",
    fieldType: CommissionFieldType.TEXT,
    dataKind: CommissionDataKind.JSON,
    placeholder: null,
    options: [],
  });

  const page15 = findPage(form, 15);
  for (const section of page15?.sections ?? []) {
    section.fields = section.fields.filter((field) => !["Compilato da", "Data", "Firma"].includes(field.label));
    reindexFields(section);
  }

  const page16 = findPage(form, 16);
  const notesSection = findSection(page16, "NOTE E OSSERVAZIONI") ?? page16?.sections[0] ?? null;
  insertFieldAfter(notesSection, "Annotazioni", {
    ...textField("p16_notes_data_presa_visione", "Data"),
    fieldType: CommissionFieldType.DATE,
    dataKind: CommissionDataKind.DATE,
  });
}

function buildAutomationOperationsField(): ParsedField {
  const operations = [
    "Alimentazione / Carico materiale",
    "Prelievo / Manipolazione",
    "Posizionamento / Orientamento",
    "Assemblaggio componenti",
    "Lavorazione meccanica",
    "Saldatura / Incollaggio",
    "Controllo qualità visivo",
    "Controllo dimensionale",
    "Marcatura / etichettatura",
    "Imballaggio / confezionamento",
    "Palletizzazione",
    "Scarico / Evacuazione",
  ];

  return {
    key: "p04_s02_operazioni_da_automatizzare",
    label: "Operazioni da automatizzare",
    placeholder: null,
    helpText: null,
    fieldType: CommissionFieldType.TABLE,
    dataKind: CommissionDataKind.JSON,
    required: false,
    indexed: false,
    sortOrder: 1,
    options: [],
    table: {
      columns: [
        {
          key: "col_1_categoria",
          label: "Categoria",
          placeholder: null,
          dataKind: CommissionDataKind.STRING,
          required: false,
          sortOrder: 1,
        },
        {
          key: "col_2_operazione",
          label: "Operazione",
          placeholder: "Descrivi l'operazione",
          dataKind: CommissionDataKind.STRING,
          required: false,
          sortOrder: 2,
        },
        {
          key: "col_3_priorita",
          label: "Priorità",
          placeholder: null,
          dataKind: CommissionDataKind.STRING,
          required: false,
          sortOrder: 3,
        },
        {
          key: "col_4_note",
          label: "Note",
          placeholder: "Note",
          dataKind: CommissionDataKind.STRING,
          required: false,
          sortOrder: 4,
        },
      ],
      defaultRows: [
        ...operations.map((operation) => ({
          col_1_categoria: "Operazioni",
          col_2_operazione: operation,
          col_3_priorita: "Bassa",
          col_4_note: "",
        })),
        {
          col_1_categoria: "Altro",
          col_2_operazione: "",
          col_3_priorita: "Bassa",
          col_4_note: "",
        },
      ],
    },
  };
}

function findPage(form: ParsedForm, pageNumber: number): ParsedPage | null {
  return form.pages.find((page) => page.pageNumber === pageNumber) ?? null;
}

function findSection(page: ParsedPage | null, titlePrefix: string): ParsedSection | null {
  if (!page) return null;
  return page.sections.find((section) => section.title.startsWith(titlePrefix) || section.title === titlePrefix) ?? null;
}

function findField(section: ParsedSection | null, labelIncludes: string): ParsedField | null {
  if (!section) return null;
  const needle = normalizeComparable(labelIncludes);
  return section.fields.find((field) => normalizeComparable(field.label).includes(needle)) ?? null;
}

function setField(section: ParsedSection | null, labelIncludes: string, patch: Partial<ParsedField>): void {
  const field = findField(section, labelIncludes);
  if (!field) return;
  Object.assign(field, { ...patch, required: false });
}

function insertFieldAfter(section: ParsedSection | null, labelIncludes: string, field: ParsedField): void {
  if (!section || section.fields.some((item) => item.key === field.key)) return;
  const index = section.fields.findIndex((item) => normalizeComparable(item.label).includes(normalizeComparable(labelIncludes)));
  section.fields.splice(index >= 0 ? index + 1 : section.fields.length, 0, field);
  reindexFields(section);
}

function replaceFieldWithFields(section: ParsedSection | null, labelIncludes: string, fields: ParsedField[]): void {
  if (!section) return;
  const replacementKeys = new Set(fields.map((field) => field.key));
  const allReplacementFieldsExist = fields.every((field) => section.fields.some((item) => item.key === field.key));
  if (allReplacementFieldsExist) {
    section.fields = section.fields.filter((field) => (
      replacementKeys.has(field.key) || !normalizeComparable(field.label).includes(normalizeComparable(labelIncludes))
    ));
    reindexFields(section);
    return;
  }

  const index = section.fields.findIndex((field) => normalizeComparable(field.label).includes(normalizeComparable(labelIncludes)));
  const missingFields = fields.filter((field) => !section.fields.some((item) => item.key === field.key));
  if (index < 0) {
    section.fields.push(...missingFields);
    reindexFields(section);
    return;
  }

  section.fields.splice(index, 1, ...missingFields);
  reindexFields(section);
}

function textField(key: string, label: string): ParsedField {
  return {
    key,
    label,
    placeholder: null,
    helpText: null,
    fieldType: CommissionFieldType.TEXT,
    dataKind: CommissionDataKind.STRING,
    required: false,
    indexed: false,
    sortOrder: 0,
    options: [],
    table: null,
  };
}

function reindexFields(section: ParsedSection): void {
  section.fields.forEach((field, index) => {
    field.sortOrder = index + 1;
  });
}

function ensureUniqueFieldKeys(form: ParsedForm): void {
  const used = new Set<string>();
  for (const page of form.pages) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        const originalKey = field.key;
        let candidate = originalKey;
        let counter = 2;
        while (used.has(candidate)) {
          candidate = `${originalKey}_${slugify(section.key).slice(0, 28) || "section"}_${counter}`;
          counter += 1;
        }
        field.key = candidate;
        used.add(candidate);
      }
    }
  }
}

function parseCommissionIntakeForm(source: string): ParsedPage[] {
  const pages: ParsedPage[] = [];
  let currentPage: ParsedPage | null = null;
  let currentSection: ParsedSection | null = null;
  let currentTable: TableDraft | null = null;
  let requiredBlock = false;
  let pendingPrompt: string | null = null;

  const ensureSection = (): ParsedSection => {
    if (!currentPage) {
      throw new Error("Commission intake field found before any page title.");
    }
    if (!currentSection) {
      currentSection = {
        key: "main",
        title: currentPage.pageNumber === 1 ? "Dati generali" : currentPage.title,
        description: null,
        sortOrder: 1,
        fields: [],
      };
      currentPage.sections.push(currentSection);
    }
    return currentSection;
  };

  const appendTable = () => {
    if (!currentTable) return;
    const section = ensureSection();
    const sortOrder = section.fields.length + 1;
    const label = currentTable.title || "Tabella";
    const columns = currentTable.columns.length
      ? currentTable.columns
      : [{ key: "col_1", label: "Valore", placeholder: null, dataKind: CommissionDataKind.STRING, required: false, sortOrder: 1 }];
    section.fields.push({
      key: fieldKeyFor(currentPage?.pageNumber ?? 0, section.fields.length + 1, label),
      label,
      placeholder: null,
      helpText: null,
      fieldType: CommissionFieldType.TABLE,
      dataKind: CommissionDataKind.JSON,
      required: currentTable.required,
      indexed: false,
      sortOrder,
      options: [],
      table: {
        columns,
        defaultRows: currentTable.rows.map((row) =>
          Object.fromEntries(columns.map((column, index) => [column.key, cleanTableCell(row[index] ?? "")])),
        ),
      },
    });
    currentTable = null;
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const originalLine = rawLine.trim();
    if (!originalLine) continue;

    if (originalLine === "/tab") {
      appendTable();
      continue;
    }

    if (originalLine === "/") {
      appendTable();
      currentPage = null;
      currentSection = null;
      requiredBlock = false;
      pendingPrompt = null;
      continue;
    }

    const pageTitle = pageTitleIndex.get(normalizeComparable(originalLine));
    const sectionMatch = originalLine.match(/^(?:num\s+)?(\d+(?:\.\d+)*)\s+(.+)$/i);
    if (pageTitle || sectionMatch) {
      appendTable();
    }

    if (pageTitle) {
      currentPage = {
        key: slugify(pageTitle),
        title: pageTitle,
        pageNumber: pages.length + 1,
        sortOrder: pages.length + 1,
        sections: [],
      };
      pages.push(currentPage);
      currentSection = null;
      pendingPrompt = null;
      continue;
    }

    if (sectionMatch) {
      if (!currentPage) continue;
      currentSection = {
        key: `section_${slugify(`${sectionMatch[1]}_${sectionMatch[2]}`)}`,
        title: `${sectionMatch[1]} ${cleanLabel(sectionMatch[2])}`,
        description: null,
        sortOrder: currentPage.sections.length + 1,
        fields: [],
      };
      currentPage.sections.push(currentSection);
      pendingPrompt = null;
      continue;
    }

    const lineWithoutComment = stripInlineComment(originalLine);
    if (!lineWithoutComment) continue;

    if (lineWithoutComment === "_") {
      requiredBlock = !requiredBlock;
      continue;
    }

    if (lineWithoutComment.toLowerCase() === "tab") {
      const section = ensureSection();
      currentTable = {
        title: section.title,
        required: requiredBlock,
        columns: [],
        rows: [],
      };
      continue;
    }

    if (currentTable) {
      const columnMatch = lineWithoutComment.match(/^col\d+\s+(.+)$/i);
      if (columnMatch) {
        const label = cleanColumnLabel(columnMatch[1]);
        currentTable.columns.push({
          key: `col_${currentTable.columns.length + 1}_${slugify(label) || "value"}`,
          label,
          placeholder: extractTextPlaceholder(columnMatch[1]),
          dataKind: inferDataKind(columnMatch[1]),
          required: requiredBlock,
          sortOrder: currentTable.columns.length + 1,
        });
        continue;
      }

      const rowMatch = lineWithoutComment.match(/^row\s+(.+)$/i);
      if (rowMatch) {
        currentTable.rows.push(splitPipeParts(rowMatch[1]));
      }
      continue;
    }

    const section = ensureSection();
    const fields = parseFieldsFromLine(lineWithoutComment, requiredBlock, pendingPrompt);
    pendingPrompt = fields.pendingPrompt;
    for (const field of fields.items) {
      const sortOrder = section.fields.length + 1;
      section.fields.push({
        ...field,
        key: fieldKeyFor(currentPage?.pageNumber ?? 0, sortOrder, field.label),
        sortOrder,
      });
    }
  }

  appendTable();
  return pages
    .sort((left, right) => (pageSortOrder.get(normalizeComparable(left.title)) ?? 999) - (pageSortOrder.get(normalizeComparable(right.title)) ?? 999))
    .map((page, index) => ({
      ...page,
      pageNumber: index + 1,
      sortOrder: index + 1,
    }));
}

function parseFieldsFromLine(
  line: string,
  requiredBlock: boolean,
  pendingPrompt: string | null,
): { items: Omit<ParsedField, "key" | "sortOrder">[]; pendingPrompt: string | null } {
  const inlineRequired = line.startsWith("_") && line.endsWith("_");
  const required = requiredBlock || inlineRequired;
  const normalizedLine = trimRequiredMarkers(line);
  const parts = splitPipeParts(normalizedLine);
  const items: Omit<ParsedField, "key" | "sortOrder">[] = [];
  let nextPendingPrompt: string | null = null;

  for (const part of parts) {
    const fields = parseFieldPart(part, required, pendingPrompt);
    items.push(...fields.items);
    nextPendingPrompt = fields.pendingPrompt ?? nextPendingPrompt;
    pendingPrompt = null;
  }

  return { items, pendingPrompt: nextPendingPrompt };
}

function parseFieldPart(
  part: string,
  required: boolean,
  pendingPrompt: string | null,
): { items: Omit<ParsedField, "key" | "sortOrder">[]; pendingPrompt: string | null } {
  const normalized = trimRequiredMarkers(part).trim();
  if (!normalized) return { items: [], pendingPrompt: null };

  const selectOptions = extractSelectOptions(normalized);
  const checkboxOptions = extractCheckboxOptions(normalized);
  const textPlaceholders = extractTextPlaceholders(normalized);
  const label = cleanLabel(
    normalized
      .replace(/^\[\]\s*/, "")
      .replace(/sel\s*\([^)]*\)/gi, "")
      .replace(/txt\s*\((?:[^()]|\([^)]*\))*\)/gi, "")
      .replace(/\[\]\s*[^[]+/g, "")
      .replace(/[:|]+$/g, ""),
  );

  if (selectOptions.length > 0) {
    return {
      pendingPrompt: null,
      items: [
        createBaseField({
          label: label || pendingPrompt || "Selezione",
          placeholder: label || pendingPrompt || "Seleziona",
          fieldType: CommissionFieldType.SELECT,
          dataKind: CommissionDataKind.STRING,
          required,
          options: selectOptions,
        }),
      ],
    };
  }

  if (checkboxOptions.length > 0) {
    const textFields = textPlaceholders
      .filter((placeholder) => placeholder.length > 0)
      .map((placeholder) =>
        createBaseField({
          label: placeholder,
          placeholder,
          fieldType: CommissionFieldType.TEXT,
          dataKind: inferDataKind(placeholder),
          required,
          options: [],
        }),
      );

    return {
      pendingPrompt: null,
      items: [
        createBaseField({
          label: label || pendingPrompt || "Selezione",
          placeholder: null,
          fieldType: CommissionFieldType.CHECKBOX_GROUP,
          dataKind: CommissionDataKind.JSON,
          required,
          options: checkboxOptions,
        }),
        ...textFields,
      ],
    };
  }

  if (normalized.toLowerCase().startsWith("desc ")) {
    const description = cleanLabel(normalized.slice(5));
    return {
      pendingPrompt: null,
      items: [
        createBaseField({
          label: description,
          placeholder: description,
          fieldType: CommissionFieldType.LONG_TEXT,
          dataKind: CommissionDataKind.STRING,
          required,
          options: [],
        }),
      ],
    };
  }

  if (textPlaceholders.length > 0 || /txt\s*\(/i.test(normalized)) {
    const placeholder = textPlaceholders[0] || label || pendingPrompt || "Valore";
    return {
      pendingPrompt: null,
      items: [
        createBaseField({
          label: label || placeholder,
          placeholder,
          fieldType: inferFieldType(`${label} ${placeholder}`),
          dataKind: inferDataKind(`${label} ${placeholder}`),
          required,
          options: [],
        }),
      ],
    };
  }

  if (normalized.startsWith("[]")) {
    const booleanLabel = cleanLabel(normalized.replace(/^\[\]\s*/, ""));
    if (booleanLabel.endsWith(":")) {
      return { items: [], pendingPrompt: booleanLabel.replace(/:$/, "") };
    }
    return {
      pendingPrompt: null,
      items: [
        createBaseField({
          label: booleanLabel || pendingPrompt || "Conferma",
          placeholder: booleanLabel || pendingPrompt || "Conferma",
          fieldType: CommissionFieldType.BOOLEAN,
          dataKind: CommissionDataKind.BOOLEAN,
          required,
          options: [],
        }),
      ],
    };
  }

  return { items: [], pendingPrompt: null };
}

function createBaseField(params: {
  label: string;
  placeholder: string | null;
  fieldType: CommissionFieldType;
  dataKind: CommissionDataKind;
  required: boolean;
  options: string[];
}): Omit<ParsedField, "key" | "sortOrder"> {
  return {
    label: params.label,
    placeholder: params.placeholder,
    helpText: null,
    fieldType: params.fieldType,
    dataKind: params.dataKind,
    required: params.required,
    indexed: shouldIndexField(params.label),
    options: params.options,
    table: null,
  };
}

async function upsertField(
  prisma: PrismaClient,
  versionId: string,
  pageId: string,
  sectionId: string,
  fieldDefinition: ParsedField,
): Promise<void> {
  const field = await prisma.commissionFormField.upsert({
    where: {
      version_id_key: {
        version_id: versionId,
        key: fieldDefinition.key,
      },
    },
    update: {
      page_id: pageId,
      section_id: sectionId,
      label: fieldDefinition.label,
      placeholder: fieldDefinition.placeholder,
      help_text: fieldDefinition.helpText,
      field_type: fieldDefinition.fieldType,
      data_kind: fieldDefinition.dataKind,
      sensitivity: CommissionFieldSensitivity.NORMAL,
      is_required: fieldDefinition.required,
      is_indexed: fieldDefinition.indexed,
      sort_order: fieldDefinition.sortOrder,
      validation_json: Prisma.JsonNull,
      visibility_json: Prisma.JsonNull,
      default_json: Prisma.JsonNull,
      metadata: {
        source: FORM_SOURCE_RELATIVE_PATH,
      },
    },
    create: {
      workspace_id: null,
      version_id: versionId,
      page_id: pageId,
      section_id: sectionId,
      key: fieldDefinition.key,
      label: fieldDefinition.label,
      placeholder: fieldDefinition.placeholder,
      help_text: fieldDefinition.helpText,
      field_type: fieldDefinition.fieldType,
      data_kind: fieldDefinition.dataKind,
      sensitivity: CommissionFieldSensitivity.NORMAL,
      is_required: fieldDefinition.required,
      is_indexed: fieldDefinition.indexed,
      sort_order: fieldDefinition.sortOrder,
      validation_json: Prisma.JsonNull,
      visibility_json: Prisma.JsonNull,
      default_json: Prisma.JsonNull,
      metadata: {
        source: FORM_SOURCE_RELATIVE_PATH,
      },
    },
    select: { id: true },
  });

  await syncFieldOptions(prisma, field.id, fieldDefinition.options);
  await syncTableDefinition(prisma, field.id, fieldDefinition);
}

async function syncFieldOptions(prisma: PrismaClient, fieldId: string, options: string[]): Promise<void> {
  const desiredValues = options.map((option, index) => slugify(option) || `option_${index + 1}`);
  await prisma.commissionFieldOption.deleteMany({
    where: {
      field_id: fieldId,
      value: { notIn: desiredValues.length ? desiredValues : ["__no_options__"] },
    },
  });

  for (const [index, option] of options.entries()) {
    await prisma.commissionFieldOption.upsert({
      where: {
        field_id_value: {
          field_id: fieldId,
          value: slugify(option) || `option_${index + 1}`,
        },
      },
      update: {
        label: option,
        sort_order: index + 1,
      },
      create: {
        workspace_id: null,
        field_id: fieldId,
        value: slugify(option) || `option_${index + 1}`,
        label: option,
        sort_order: index + 1,
      },
    });
  }
}

async function syncTableDefinition(
  prisma: PrismaClient,
  fieldId: string,
  fieldDefinition: ParsedField,
): Promise<void> {
  if (!fieldDefinition.table) return;

  const tableDefinition = await prisma.commissionTableDefinition.upsert({
    where: { field_id: fieldId },
    update: {
      key: `${fieldDefinition.key}_table`,
      title: fieldDefinition.label,
      min_rows: fieldDefinition.required ? 1 : null,
      max_rows: null,
      allow_add_rows: true,
      metadata: {
        defaultRows: fieldDefinition.table.defaultRows,
      },
    },
    create: {
      workspace_id: null,
      field_id: fieldId,
      key: `${fieldDefinition.key}_table`,
      title: fieldDefinition.label,
      min_rows: fieldDefinition.required ? 1 : null,
      max_rows: null,
      allow_add_rows: true,
      metadata: {
        defaultRows: fieldDefinition.table.defaultRows,
      },
    },
    select: { id: true },
  });

  for (const column of fieldDefinition.table.columns) {
    await prisma.commissionTableColumn.upsert({
      where: {
        table_definition_id_key: {
          table_definition_id: tableDefinition.id,
          key: column.key,
        },
      },
      update: {
        label: column.label,
        placeholder: column.placeholder,
        data_kind: column.dataKind,
        sensitivity: CommissionFieldSensitivity.NORMAL,
        is_required: column.required,
        is_indexed: false,
        sort_order: column.sortOrder,
        validation_json: Prisma.JsonNull,
      },
      create: {
        workspace_id: null,
        table_definition_id: tableDefinition.id,
        key: column.key,
        label: column.label,
        placeholder: column.placeholder,
        data_kind: column.dataKind,
        sensitivity: CommissionFieldSensitivity.NORMAL,
        is_required: column.required,
        is_indexed: false,
        sort_order: column.sortOrder,
        validation_json: Prisma.JsonNull,
      },
    });
  }
}

function fieldKeyFor(pageNumber: number, sortOrder: number, label: string): string {
  if (pageNumber === 1 && sortOrder <= LEGACY_GENERAL_FIELD_KEYS.length) {
    return LEGACY_GENERAL_FIELD_KEYS[sortOrder - 1];
  }
  return `p${String(pageNumber).padStart(2, "0")}_f${String(sortOrder).padStart(3, "0")}_${slugify(label) || "field"}`;
}

function splitPipeParts(value: string): string[] {
  return value
    .split("|")
    .map((part) => trimRequiredMarkers(part).trim())
    .filter(Boolean);
}

function stripInlineComment(value: string): string {
  return value.replace(/\s+#.*$/g, "").trim();
}

function trimRequiredMarkers(value: string): string {
  return value.trim().replace(/^_+\s*/, "").replace(/\s*_+$/g, "").trim();
}

function cleanLabel(value: string): string {
  return value
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+:/g, ":")
    .replace(/:\s*$/g, "")
    .replace(/^[-:,\s]+|[-:,\s]+$/g, "")
    .trim();
}

function cleanColumnLabel(value: string): string {
  return cleanLabel(replaceTextExpressions(value).replace(/sel\s*\(([^)]*)\)/gi, "$1"));
}

function cleanTableCell(value: string): string {
  return cleanLabel(replaceTextExpressions(value, "").replace(/\[\]/g, ""));
}

function extractTextPlaceholder(value: string): string | null {
  return extractTextPlaceholders(value)[0] ?? null;
}

function extractTextPlaceholders(value: string): string[] {
  return extractFunctionArguments(value, "txt").map((placeholder) => cleanLabel(placeholder));
}

function extractSelectOptions(value: string): string[] {
  const match = value.match(/sel\s*\(([^)]*)\)/i);
  if (!match) return [];
  return splitOptions(match[1]);
}

function extractCheckboxOptions(value: string): string[] {
  const withoutPromptCheckbox = value.replace(/^\[\]\s*[^[]*?(?=\[\]|txt\s*\(|$)/i, "");
  const options: string[] = [];
  for (const match of withoutPromptCheckbox.matchAll(/\[\]\s*([^[]+)/g)) {
    const option = cleanLabel(match[1].replace(/txt\s*\([^)]*\)/gi, ""));
    if (option) options.push(option);
  }
  return options;
}

function splitOptions(value: string): string[] {
  return value
    .split(",")
    .map((option) => cleanLabel(option))
    .filter(Boolean);
}

function extractFunctionArguments(value: string, functionName: string): string[] {
  const args: string[] = [];
  let searchIndex = 0;
  const matcher = new RegExp(`${functionName}\\s*\\(`, "gi");

  while (searchIndex < value.length) {
    matcher.lastIndex = searchIndex;
    const match = matcher.exec(value);
    if (!match) break;

    let depth = 1;
    let cursor = match.index + match[0].length;
    const argStart = cursor;
    while (cursor < value.length && depth > 0) {
      if (value[cursor] === "(") depth += 1;
      if (value[cursor] === ")") depth -= 1;
      cursor += 1;
    }

    if (depth === 0) {
      args.push(value.slice(argStart, cursor - 1));
    }
    searchIndex = cursor;
  }

  return args;
}

function replaceTextExpressions(value: string, emptyReplacement?: string): string {
  let result = "";
  let cursor = 0;
  const matcher = /txt\s*\(/gi;

  while (cursor < value.length) {
    matcher.lastIndex = cursor;
    const match = matcher.exec(value);
    if (!match) {
      result += value.slice(cursor);
      break;
    }

    result += value.slice(cursor, match.index);
    let depth = 1;
    let end = match.index + match[0].length;
    const argStart = end;
    while (end < value.length && depth > 0) {
      if (value[end] === "(") depth += 1;
      if (value[end] === ")") depth -= 1;
      end += 1;
    }

    if (depth === 0) {
      const argument = cleanLabel(value.slice(argStart, end - 1));
      result += typeof emptyReplacement === "string" ? emptyReplacement : argument;
      cursor = end;
    } else {
      result += value.slice(match.index);
      break;
    }
  }

  return result;
}

function inferFieldType(value: string): CommissionFieldType {
  const normalized = value.toLowerCase();
  if (/\bdata\b/.test(normalized)) return CommissionFieldType.DATE;
  return CommissionFieldType.TEXT;
}

function inferDataKind(value: string): CommissionDataKind {
  const normalized = value.toLowerCase();
  if (/\bdata\b/.test(normalized)) return CommissionDataKind.DATE;
  return CommissionDataKind.STRING;
}

function shouldIndexField(label: string): boolean {
  return [
    "nr. commessa",
    "cliente",
    "descrizione progetto",
    "data sopralluogo",
    "stabilimento",
    "referente fg automazioni",
  ].some((keyword) => label.toLowerCase().includes(keyword));
}
