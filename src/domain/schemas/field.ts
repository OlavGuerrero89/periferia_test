import { z } from "zod";
export const FieldResolutionSchema = z.object({ requestedField: z.string(), canonicalKey: z.string().nullable(), value: z.unknown().nullable(), status: z.enum(["resolved", "missing", "ambiguous"]), source: z.string().nullable() });
export type FieldResolution = z.infer<typeof FieldResolutionSchema>;
