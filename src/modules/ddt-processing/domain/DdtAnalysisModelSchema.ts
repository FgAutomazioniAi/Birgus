import { z } from "zod";

const numberFromModel = z.preprocess((value) => {
  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }
  return value;
}, z.number().finite());

export const ddtAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    movement_type: {
      type: "string",
      enum: ["entrata", "uscita", "sconosciuto"],
    },
    movement_scope: {
      type: "string",
      enum: ["interno_fg", "esterno", "sconosciuto"],
    },
    main_warehouse_action: {
      type: "string",
      enum: ["aggiunta_principale", "rimozione_principale", "invariato", "sconosciuto"],
    },
    bolla_number: { type: "string" },
    commessa_reference: { type: "string" },
    transfer_note: { type: "string" },
    article_count: {
      type: "integer",
      minimum: 0,
    },
    article_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          article_type: { type: "string" },
          quantity: {
            type: "number",
            minimum: 0,
          },
          unit: { type: "string" },
        },
        required: ["article_type", "quantity", "unit"],
      },
    },
    analysis_summary: { type: "string" },
  },
  required: [
    "movement_type",
    "movement_scope",
    "main_warehouse_action",
    "bolla_number",
    "commessa_reference",
    "transfer_note",
    "article_count",
    "article_items",
    "analysis_summary",
  ],
} satisfies Record<string, unknown>;

export const DdtAnalysisModelSchema = z.object({
  movement_type: z.enum(["entrata", "uscita", "sconosciuto"]),
  movement_scope: z.enum(["interno_fg", "esterno", "sconosciuto"]),
  main_warehouse_action: z.enum(["aggiunta_principale", "rimozione_principale", "invariato", "sconosciuto"]),
  bolla_number: z.string(),
  commessa_reference: z.string(),
  transfer_note: z.string(),
  article_count: z.preprocess((value) => {
    if (typeof value === "string" && value.trim().length > 0) {
      return Number.parseInt(value, 10);
    }
    return value;
  }, z.number().int().min(0)),
  article_items: z.array(z.object({
    article_type: z.string(),
    quantity: numberFromModel.pipe(z.number().min(0)),
    unit: z.string(),
  }).strict()),
  analysis_summary: z.string(),
}).strict();

export type DdtAnalysisModelPayload = z.infer<typeof DdtAnalysisModelSchema>;

export function parseDdtAnalysisModelPayload(value: string): DdtAnalysisModelPayload {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? value.slice(start, end + 1) : value;
  const parsed = JSON.parse(candidate) as JSONValue;
  return DdtAnalysisModelSchema.parse(parsed);
}

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };
