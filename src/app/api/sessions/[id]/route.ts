import { NextResponse } from "next/server";
import { getApplication } from "@/application/process-request";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = getApplication().getSession(id);
  if (!session) return NextResponse.json({ error: { code: "sesion_no_encontrada", message: "No se encontró la sesión." } }, { status: 404 });
  return NextResponse.json({
    id: session.id,
    turn: session.turn,
    messages: session.messages,
    approval: session.pendingApproval ? {
      accion: session.pendingApproval.accion,
      casoId: session.pendingApproval.casoId,
      estado: session.pendingApproval.estado,
      resultadoEjecucion: session.pendingApproval.resultadoEjecucion,
    } : { estado: "sin_confirmacion" },
    lastActivity: session.lastActivity,
  });
}
