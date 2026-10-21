import { z } from "zod";

export const FieldResolutionSchema = z.object({
  requestedField: z.string().min(1),
  canonicalKey: z.string().nullable(),
  value: z.unknown().nullable(),
  status: z.enum(["lleno", "faltante", "requiere_confirmacion"]),
  source: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  note: z.string().optional(),
});
export type FieldResolution = z.infer<typeof FieldResolutionSchema>;
