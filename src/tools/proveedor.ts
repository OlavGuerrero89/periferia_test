import { open } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ResultadoHerramienta, ToolContext } from "../domain/types";
import { buildPackage, generateForm } from "../infrastructure/filesystem/artifacts";
import { getSupportStatuses, loadCase, mapFields } from "../infrastructure/filesystem/case-data";
import { assertSafeWriteTarget, ensureOutputDirectory, resolveInside, validateCaseId } from "../infrastructure/filesystem/paths";
import { writeAuditLog } from "../infrastructure/logging/audit";

const caseArgs = z.object({ casoId: z.string().min(1).max(80).describe("Identificador de la carpeta del caso; no es una ruta.") }).strict();

async function run<T>(name: string, casoId: string, ctx: ToolContext, action: () => Promise<T>): Promise<ResultadoHerramienta<T>> {
  let result: ResultadoHerramienta<T>;
  try {
    validateCaseId(casoId);
    result = { ok: true, data: await action() };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const message = code === "EEXIST" ? "El archivo ENVIO-SIMULADO.md ya existe; no se sobrescribió." : error instanceof Error ? error.message : "No se pudo completar la operación.";
    result = { ok: false, error: { codigo: code === "EEXIST" ? "archivo_ya_existe" : message.includes("no es válido") ? "caso_invalido" : "operacion_fallida", mensaje: message } };
  }
  try {
    await writeAuditLog(ctx, casoId, { tool: name, ok: result.ok, summary: result.ok ? "Operación completada." : result.error.mensaje });
  } catch {
    if (result.ok) return { ok: false, error: { codigo: "auditoria_fallida", mensaje: "No se pudo registrar la operación; el resultado no se considera completado." } };
  }
  return result;
}

export const leer_solicitud = {
  name: "proveedor_leer_solicitud",
  description: "Lee y normaliza la solicitud, sus campos y los estados de soportes de un caso autorizado.",
  args: caseArgs,
  async execute(args: { casoId: string }, ctx: ToolContext) {
    return run("proveedor_leer_solicitud", args.casoId, ctx, async () => {
      const data = await loadCase(ctx, args.casoId);
      const soportes = await getSupportStatuses(data, ctx);
      return { caso: data.normalized, soportes };
    });
  },
};

export const mapear_campos = {
  name: "proveedor_mapear_campos",
  description: "Resuelve las etiquetas de la plantilla contra el maestro y el glosario con procedencia verificable.",
  args: caseArgs,
  async execute(args: { casoId: string }, ctx: ToolContext) {
    return run("proveedor_mapear_campos", args.casoId, ctx, async () => {
      const data = await loadCase(ctx, args.casoId);
      return { casoId: data.normalized.casoId, campos: mapFields(data) };
    });
  },
};

export const generar_formulario = {
  name: "proveedor_generar_formulario",
  description: "Genera el formulario solicitado con los valores disponibles y sin confirmar datos pendientes.",
  args: caseArgs,
  async execute(args: { casoId: string }, ctx: ToolContext) {
    return run("proveedor_generar_formulario", args.casoId, ctx, async () => {
      const data = await loadCase(ctx, args.casoId);
      const artefacto = await generateForm(data, ctx);
      const pendientes = mapFields(data).filter(item => item.resolucion.estado !== "lleno").map(item => item.campo.etiqueta);
      return { casoId: data.normalized.casoId, artefactos: [artefacto], pendientes, ...(data.normalized.formato === "portal" ? { nota: "Formato no soportado para automatización; los valores se prepararon para copia manual." } : {}) };
    });
  },
};

export const armar_paquete = {
  name: "proveedor_armar_paquete",
  description: "Prepara un paquete local para revisión humana con formulario, checklist, soportes presentes y borrador de correo.",
  args: caseArgs,
  async execute(args: { casoId: string }, ctx: ToolContext) {
    return run("proveedor_armar_paquete", args.casoId, ctx, async () => {
      const data = await loadCase(ctx, args.casoId);
      const supports = await getSupportStatuses(data, ctx);
      const result = await buildPackage(data, ctx, supports);
      return { casoId: data.normalized.casoId, estado: result.state, artefactos: result.artifacts, checklist: supports };
    });
  },
};

export const simular_envio = {
  name: "proveedor_simular_envio",
  description: "Crea el archivo local de envío simulado únicamente con aprobación humana vigente para el mismo caso.",
  args: caseArgs,
  async execute(args: { casoId: string }, ctx: ToolContext) {
    const approval = ctx.approval;
    if (!approval || approval.estado !== "aprobado" || approval.accion !== "simular_envio" || approval.casoId !== args.casoId) {
      try { await writeAuditLog(ctx, args.casoId, { tool: "proveedor_simular_envio", ok: false, summary: "requiere confirmación explícita" }); } catch { /* ID inválido: no se crea una ruta de auditoría. */ }
      return { ok: false as const, error: { codigo: "requiere_confirmacion", mensaje: "requiere confirmación explícita" } };
    }
    const result = await run("proveedor_simular_envio", args.casoId, ctx, async () => {
      const caseId = validateCaseId(args.casoId);
      const outputDir = resolveInside(ctx.projectRoot, "out", caseId);
      await ensureOutputDirectory(ctx.projectRoot, outputDir);
      const destination = resolveInside(outputDir, "ENVIO-SIMULADO.md");
      const safeDestination = await assertSafeWriteTarget(ctx.projectRoot, destination);
      const handle = await open(safeDestination, "wx");
      try {
        await handle.writeFile(`# Envío simulado — ${caseId}\n\nEste archivo representa una acción local de prueba. No se enviaron documentos, no se firmaron ni se cargaron en un portal.\n\nAprobación asociada a la sesión: ${ctx.sessionId}\nFecha: ${ctx.now.toISOString()}\n`, "utf8");
      } finally { await handle.close(); }
      approval.resultadoEjecucion = "completada";
      return { casoId: caseId, artefacto: { ruta: path.relative(ctx.projectRoot, destination).split(path.sep).join("/"), formato: "markdown" }, resultadoEjecucion: "completada" as const };
    });
    if (!result.ok) approval.resultadoEjecucion = "fallida";
    approval.estado = "expirado";
    return result;
  },
};

export const proveedorTools = [leer_solicitud, mapear_campos, generar_formulario, armar_paquete, simular_envio] as const;
export type ProviderTool = (typeof proveedorTools)[number];
export function parseToolArgs(tool: ProviderTool, input: unknown): unknown { return tool.args.parse(input); }
export async function executeTool(tool: ProviderTool, input: unknown, ctx: ToolContext): Promise<ResultadoHerramienta<unknown>> {
  try { return await tool.execute(parseToolArgs(tool, input) as never, ctx); }
  catch {
    const candidate = input && typeof input === "object" ? (input as Record<string, unknown>).casoId : undefined;
    if (typeof candidate === "string") {
      try { await writeAuditLog(ctx, candidate, { tool: tool.name, ok: false, summary: "Argumentos rechazados por el esquema." }); } catch { /* Caso inválido: no abrir una ruta de auditoría. */ }
    }
    return { ok: false, error: { codigo: "argumentos_invalidos", mensaje: "Los argumentos no cumplen el contrato de la herramienta." } };
  }
}
