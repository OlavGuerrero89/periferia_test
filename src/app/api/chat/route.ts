import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { processRequest } from "@/application/process-request";

export const runtime = "nodejs";

const RequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(8000),
}).strict();

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json() as unknown; }
  catch { return NextResponse.json({ error: { code: "json_invalido", message: "El cuerpo debe ser JSON válido." } }, { status: 400 }); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "solicitud_invalida", message: "Envía un mensaje de texto y, si aplica, un sessionId válido." } }, { status: 400 });
  const sessionId = parsed.data.sessionId ?? randomUUID();
  try {
    const result = await processRequest(sessionId, parsed.data.message);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible procesar el mensaje.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 502;
    return NextResponse.json({ sessionId, reply: message, toolCalls: [], needsConfirmation: false }, { status });
  }
}
