import { z } from "zod";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string().max(20_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(500),
    z.record(z.string().min(1).max(200), jsonValueSchema),
  ]),
);

export const jsonObjectSchema = z.record(z.string().min(1).max(200), jsonValueSchema);
