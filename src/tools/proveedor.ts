import { z } from "zod";
export const proveedorInputSchema = z.object({ caseId: z.string().min(1) });
export async function consultarProveedor(input: z.infer<typeof proveedorInputSchema>) { proveedorInputSchema.parse(input); throw new Error("Implementar conforme al PRD y fixtures"); }
