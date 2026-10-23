import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentApplication } from "@/application/agent-loop";
import { buildFallbackReply } from "@/application/fallback";
import type { LlmAdapter, LlmMessage, LlmReply } from "@/infrastructure/llm/adapter";
import type { ProviderTool } from "@module/tools/proveedor";

const roots: string[] = [];

async function setupRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "periferia-fallback-"));
  roots.push(root);
  await cp(path.join(process.cwd(), "fixtures/tests/demo-reto-01"), path.join(root, "fixtures/tests/demo-reto-01"), { recursive: true });
  await cp(path.join(process.cwd(), "modulo"), path.join(root, "modulo"), { recursive: true });
  return root;
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

class UnavailableAdapter implements LlmAdapter {
  provider = "openai";
  model = "gpt-6-luna";
  constructor(private readonly message: string) {}
  async complete(_messages: LlmMessage[], _tools: readonly ProviderTool[]): Promise<LlmReply> {
    void _messages;
    void _tools;
    throw new Error(this.message);
  }
}

describe("fallback determinista del agente", () => {
  it("procesa un caso explícito sin modelo y conserva la confirmación humana", async () => {
    const root = await setupRoot();
    const app = new AgentApplication(new UnavailableAdapter("Falta OPENAI_API_KEY en el entorno del servidor."), root, undefined, "fixtures/tests/demo-reto-01");

    const result = await app.process("fallback-1", "Procesa el caso demo-sintetica");

    expect(result.mode).toBe("fallback");
    expect(result.reply).toContain("Procesé el caso Cliente Sintético (demo-sintetica)");
    expect(result.reply).toContain("No se envió ni firmó ningún documento");
    expect(result.toolCalls.map(call => call.name)).toEqual([
      "proveedor_leer_solicitud",
      "proveedor_mapear_campos",
      "proveedor_generar_formulario",
      "proveedor_armar_paquete",
    ]);
    expect(result.needsConfirmation).toBe(true);
    expect(app.getSession("fallback-1")?.messages).toHaveLength(2);
    expect(await readFile(path.join(root, "out/demo-sintetica/formulario.xlsx"))).toBeInstanceOf(Buffer);
    await expect(readFile(path.join(root, "out/demo-sintetica/ENVIO-SIMULADO.md"))).rejects.toThrow();

    const confirmed = await app.process("fallback-1", "Sí, confirmo");
    expect(confirmed.toolCalls[0]?.name).toBe("proveedor_simular_envio");
    expect(await readFile(path.join(root, "out/demo-sintetica/ENVIO-SIMULADO.md"), "utf8")).toContain("No se enviaron documentos");
  });

  it("da pasos concretos si el proveedor devuelve límite/cuota y mantiene viva la sesión", async () => {
    const root = await setupRoot();
    const app = new AgentApplication(new UnavailableAdapter("El proveedor alcanzó su límite de solicitudes; intenta de nuevo en unos segundos."), root, undefined, "fixtures/tests/demo-reto-01");

    const result = await app.process("fallback-2", "Procesa el caso demo-sintetica");

    expect(result.mode).toBe("fallback");
    expect(result.reply).toContain("límite temporal o de cuota");
    expect(result.reply).toContain("uso y los límites de la API");
    expect(result.toolCalls).toHaveLength(4);
    expect(result.needsConfirmation).toBe(true);
    expect(app.getSession("fallback-2")?.pendingApproval?.estado).toBe("esperando_confirmacion");
  });

  it.each([
    ["El proveedor rechazó la credencial configurada.", "clave activa de la plataforma API"],
    ["El proveedor de lenguaje no está disponible temporalmente.", "Puedes volver a intentarlo más tarde"],
  ])("da una guía segura para errores del proveedor", (error, expected) => {
    const reply = buildFallbackReply(new Error(error), []);
    expect(reply).toContain(expected);
    expect(reply).toContain("No ejecuté herramientas ni preparé archivos");
    expect(reply).not.toContain(error);
  });

  it("no interpreta una solicitud ambigua como caso ni inicia herramientas", async () => {
    const root = await setupRoot();
    const app = new AgentApplication(new UnavailableAdapter("El proveedor de lenguaje no está disponible temporalmente."), root, undefined, "fixtures/tests/demo-reto-01");
    const result = await app.process("fallback-3", "Ayúdame con el registro de proveedor");

    expect(result.mode).toBe("fallback");
    expect(result.toolCalls).toEqual([]);
    expect(result.reply).toContain("Procesa el caso <id>");
    expect(result.needsConfirmation).toBe(false);
  });
});
