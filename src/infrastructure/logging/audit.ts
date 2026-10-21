import { appendFile } from "node:fs/promises";
import path from "node:path";
import type { ToolContext } from "@/domain/types";
import { assertSafeWriteTarget, ensureOutputDirectory, resolveInside, validateCaseId } from "@/infrastructure/filesystem/paths";

export async function writeAuditLog(
  ctx: ToolContext,
  caseId: string,
  event: { tool: string; ok: boolean; summary: string },
): Promise<void> {
  const validCase = validateCaseId(caseId);
  const outDir = resolveInside(ctx.projectRoot, "out", validCase);
  await ensureOutputDirectory(ctx.projectRoot, outDir);
  const safeSummary = event.summary.replace(/[\r\n\t]/g, " ").slice(0, 240);
  const line = JSON.stringify({ ts: ctx.now.toISOString(), herramienta: event.tool, ok: event.ok, resumen: safeSummary });
  const logfile = await assertSafeWriteTarget(ctx.projectRoot, path.join(outDir, "log.jsonl"));
  await appendFile(logfile, `${line}\n`, "utf8");
}
