import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentApplication } from "@/application/agent-loop";
import type { LlmAdapter, LlmMessage, LlmReply } from "@/infrastructure/llm/adapter";
import type { ProviderTool } from "@/tools/proveedor";

const roots: string[] = [];

async function setupRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "periferia-approval-"));
  roots.push(root);
  await cp(path.join(process.cwd(), "fixtures/demo/reto-01"), path.join(root, "fixtures/demo/reto-01"), { recursive: true });
  await cp(path.join(process.cwd(), "agent"), path.join(root, "agent"), { recursive: true });
  await cp(path.join(process.cwd(), "src/knowledge"), path.join(root, "src/knowledge"), { recursive: true });
  return root;
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

class PlannedAdapter implements LlmAdapter {
  provider = "test";
  model = "fake";
  private calls = 0;
  async complete(_messages: LlmMessage[], _tools: readonly ProviderTool[]): Promise<LlmReply> {
    void _messages;
    void _tools;
    this.calls += 1;
    if (this.calls === 1) return { text: "Prepararé el paquete.", toolCalls: [{ id: "call-1", name: "proveedor_armar_paquete", arguments: { casoId: "demo-sintetica" } }] };
    return { text: "El paquete quedó preparado para revisión.", toolCalls: [] };
  }
}

describe("confirmación humana", () => {
  it("crea solo el envío simulado tras confirmación inmediata", async () => {
    const root = await setupRoot();
    const app = new AgentApplication(new PlannedAdapter(), root, undefined, "fixtures/demo/reto-01");
    const prepared = await app.process("s-1", "Prepara el paquete demo-sintetica");
    expect(prepared.needsConfirmation).toBe(true);
    expect(prepared.reply).toContain("Responde sí o no");

    const confirmed = await app.process("s-1", "Sí, confirmo");
    expect(confirmed.toolCalls[0]?.name).toBe("proveedor_simular_envio");
    expect(confirmed.reply).toContain("No se envió");
    const artifact = await readFile(path.join(root, "out/demo-sintetica/ENVIO-SIMULADO.md"), "utf8");
    expect(artifact).toContain("No se enviaron documentos");
    expect(app.getSession("s-1")?.pendingApproval?.resultadoEjecucion).toBe("completada");
  });

  it("expira si llega otro turno antes de la aprobación", async () => {
    const root = await setupRoot();
    const app = new AgentApplication(new PlannedAdapter(), root, undefined, "fixtures/demo/reto-01");
    await app.process("s-2", "Prepara el paquete demo-sintetica");
    await app.process("s-2", "Muéstrame los pendientes");
    const late = await app.process("s-2", "Sí");
    expect(late.toolCalls).toHaveLength(0);
    expect(app.getSession("s-2")?.pendingApproval?.estado).toBe("expirado");
    await expect(readFile(path.join(root, "out/demo-sintetica/ENVIO-SIMULADO.md"))).rejects.toThrow();
  });

  it("registra el rechazo y no crea el archivo simulado", async () => {
    const root = await setupRoot();
    const app = new AgentApplication(new PlannedAdapter(), root, undefined, "fixtures/demo/reto-01");
    await app.process("s-3", "Prepara el paquete demo-sintetica");
    const rejected = await app.process("s-3", "No, cancela");
    expect(rejected.needsConfirmation).toBe(false);
    expect(app.getSession("s-3")?.pendingApproval?.estado).toBe("rechazado");
    await expect(readFile(path.join(root, "out/demo-sintetica/ENVIO-SIMULADO.md"))).rejects.toThrow();
  });
});
