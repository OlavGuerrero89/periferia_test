import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AprobacionPendiente } from "@/domain/types";
import type { LlmAdapter, LlmMessage } from "@/infrastructure/llm/adapter";
import { executeTool, proveedorTools, type ProviderTool } from "@module/tools/proveedor";

export interface VisibleToolCall {
  name: string;
  arguments: unknown;
  ok: boolean;
  summary: string;
}

export interface ConversationMessage { role: "user" | "assistant"; content: string; createdAt: string; tools?: VisibleToolCall[]; needsConfirmation?: boolean }

export interface ChatSession {
  id: string;
  turn: number;
  messages: ConversationMessage[];
  llmMessages: LlmMessage[];
  pendingApproval?: AprobacionPendiente;
  estimatedTokens: number;
  lastActivity: string;
}

export interface ProcessResult {
  reply: string;
  toolCalls: VisibleToolCall[];
  needsConfirmation: boolean;
  sessionId: string;
}

function boundedInteger(raw: number, fallback: number, minimum: number, maximum: number): number {
  return Number.isFinite(raw) ? Math.max(minimum, Math.min(maximum, Math.floor(raw))) : fallback;
}

function safeSummary(result: unknown): string {
  if (!result || typeof result !== "object") return "Resultado recibido.";
  const root = result as Record<string, unknown>;
  if (root.ok !== true) {
    const error = root.error && typeof root.error === "object" ? (root.error as Record<string, unknown>).mensaje : undefined;
    return typeof error === "string" ? error : "La herramienta informó un error.";
  }
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
  if (Array.isArray(data.campos)) return `${data.campos.length} campos revisados; valores y fuentes enviados al agente. ` + data.campos.map((item: unknown) => {
    if (!item || typeof item !== "object") return "";
    const entry = item as Record<string, unknown>;
    const resolution = entry.resolucion && typeof entry.resolucion === "object" ? (entry.resolucion as Record<string, unknown>).estado : "";
    const field = entry.campo && typeof entry.campo === "object" ? (entry.campo as Record<string, unknown>).etiqueta : "campo";
    return `${String(field)}: ${String(resolution)}`;
  }).filter(Boolean).join("; ");
  if (Array.isArray(data.artefactos)) return `${data.artefactos.length} artefacto(s) generado(s).`;
  if (data.caso && typeof data.caso === "object") {
    const caso = data.caso as Record<string, unknown>;
    return `Solicitud leída: ${String(caso.cliente)}, ${String(caso.formato)}, ${Array.isArray(caso.campos) ? caso.campos.length : 0} campos.`;
  }
  return "Operación completada.";
}

function normalizeDecision(message: string): string { return message.trim().toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function isAffirmative(message: string): boolean { return /^(si|confirmo|confirmar|de acuerdo|aprobado|dale|autorizo)(\b|[,!.\s])|\bsi,? confirmo\b|\bconfirmo el envio simulado\b/.test(normalizeDecision(message)); }
function isNegative(message: string): boolean { return /^(no|rechazo|cancela|cancelar|no lo crees|no lo hagas)(\b|[,!.\s])/.test(normalizeDecision(message)); }

export class AgentApplication {
  private readonly sessions = new Map<string, ChatSession>();
  private readonly adapter: LlmAdapter;
  private readonly projectRoot: string;
  private readonly fixtureRoot: string;
  private readonly maxIterations: number;

  constructor(adapter: LlmAdapter, projectRoot = process.cwd(), maxIterations = Number(process.env.AGENT_MAX_ITERATIONS ?? 12), fixtureRoot = process.env.DATA_DIR ?? "fixtures/demo/reto-01") {
    this.adapter = adapter;
    this.projectRoot = projectRoot;
    this.maxIterations = boundedInteger(maxIterations, 12, 1, 25);
    this.fixtureRoot = fixtureRoot;
  }

  getSession(sessionId: string): ChatSession | undefined { return this.sessions.get(sessionId); }

  async process(sessionId: string, message: string): Promise<ProcessResult> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = { id: sessionId, turn: 0, messages: [], llmMessages: [], estimatedTokens: 0, lastActivity: new Date().toISOString() };
      this.sessions.set(sessionId, session);
    }
    session.turn += 1;
    const now = new Date();
    session.lastActivity = now.toISOString();
    const userMessage: ConversationMessage = { role: "user", content: message, createdAt: now.toISOString() };
    session.messages.push(userMessage);

    const pending = session.pendingApproval;
    if (pending?.estado === "esperando_confirmacion") {
      if (pending.creadaEnTurno === session.turn - 1 && isAffirmative(message)) {
        pending.estado = "aprobado";
        const simulate = proveedorTools.find(tool => tool.name === "proveedor_simular_envio");
        if (!simulate) throw new Error("La herramienta de envío simulado no está registrada.");
        const result = await executeTool(simulate, { casoId: pending.casoId }, {
          projectRoot: this.projectRoot, fixtureRoot: this.fixtureRoot, sessionId, now, approval: pending,
        });
        pending.resultadoEjecucion = result.ok ? "completada" : "fallida";
        const resultData = result.ok && result.data && typeof result.data === "object" ? result.data as { artefacto?: { ruta?: string } } : undefined;
        const reply = result.ok
          ? `Confirmación registrada. Se creó el archivo local ${resultData?.artefacto?.ruta ?? "ENVIO-SIMULADO.md"}. No se envió, firmó ni cargó ningún documento.`
          : `No se pudo completar el envío simulado: ${result.error.mensaje}`;
        session.messages.push({ role: "assistant", content: reply, createdAt: new Date().toISOString(), tools: [{ name: "proveedor_simular_envio", arguments: { casoId: pending.casoId }, ok: result.ok, summary: result.ok ? "Archivo local creado; no hubo envío externo." : result.error.mensaje }] });
        session.llmMessages.push({ role: "user", content: message }, { role: "assistant", content: reply });
        return { reply, toolCalls: [{ name: "proveedor_simular_envio", arguments: { casoId: pending.casoId }, ok: result.ok, summary: result.ok ? "Archivo local creado; no hubo envío externo." : result.error.mensaje }], needsConfirmation: false, sessionId };
      }
      if (pending.creadaEnTurno === session.turn - 1 && isNegative(message)) {
        pending.estado = "rechazado";
        const reply = `Entendido. No creé el envío simulado para el caso ${pending.casoId}.`;
        session.messages.push({ role: "assistant", content: reply, createdAt: new Date().toISOString() });
        session.llmMessages.push({ role: "user", content: message }, { role: "assistant", content: reply });
        return { reply, toolCalls: [], needsConfirmation: false, sessionId };
      }
      pending.estado = "expirado";
    }

    session.llmMessages.push({ role: "user", content: message });
    const systemPrompt = await this.loadSystemPrompt();
    const conversation: LlmMessage[] = [{ role: "system", content: systemPrompt }, ...session.llmMessages];
    const visibleCalls: VisibleToolCall[] = [];
    let preparedCaseId: string | undefined;
    let finalText = "";

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      const requestEstimate = Math.ceil(JSON.stringify(conversation).length / 4);
      const tokenLimit = boundedInteger(Number(process.env.SESSION_TOKEN_LIMIT ?? 20000), 20000, 1000, 1000000);
      if (session.estimatedTokens + requestEstimate >= tokenLimit) {
        finalText = "Alcancé el límite de tokens configurado para esta sesión. Inicia una sesión nueva o reduce el historial antes de continuar.";
        break;
      }
      let reply;
      try { reply = await this.adapter.complete(conversation, proveedorTools); }
      catch (error) {
        finalText = error instanceof Error ? error.message : "El proveedor de lenguaje no respondió. Intenta de nuevo.";
        break;
      }
      session.estimatedTokens += reply.inputTokens !== undefined
        ? reply.inputTokens + (reply.outputTokens ?? 0)
        : requestEstimate + Math.ceil(reply.text.length / 4);
      if (reply.toolCalls.length === 0) { finalText = reply.text.trim(); break; }
      const assistantCalls = reply.toolCalls.map(call => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: JSON.stringify(call.arguments) } }));
      conversation.push({ role: "assistant", content: reply.text || null, tool_calls: assistantCalls });
      for (const requested of reply.toolCalls) {
        const tool = proveedorTools.find(item => item.name === requested.name);
        let result: unknown;
        if (!tool) result = { ok: false, error: { codigo: "herramienta_no_disponible", mensaje: "La herramienta solicitada no está habilitada." } };
        else result = await executeTool(tool as ProviderTool, requested.arguments, { projectRoot: this.projectRoot, fixtureRoot: this.fixtureRoot, sessionId, now, approval: session.pendingApproval });
        const ok = !!result && typeof result === "object" && (result as Record<string, unknown>).ok === true;
        const summary = safeSummary(result);
        visibleCalls.push({ name: requested.name, arguments: requested.arguments, ok, summary });
        if (requested.name === "proveedor_armar_paquete" && ok && requested.arguments && typeof requested.arguments === "object") {
          const value = (requested.arguments as Record<string, unknown>).casoId;
          if (typeof value === "string") preparedCaseId = value;
        }
        conversation.push({ role: "tool", tool_call_id: requested.id, content: JSON.stringify(result) });
      }
      if (iteration === this.maxIterations - 1) finalText = "Alcancé el límite de pasos de esta consulta. Ya reuní los resultados indicados arriba; dime qué pendiente quieres revisar primero.";
    }
    if (!finalText) finalText = "No recibí una respuesta final del modelo. Puedes intentar de nuevo.";
    if (preparedCaseId) {
      const question = `¿Confirmas que cree el archivo local \`out/${preparedCaseId}/ENVIO-SIMULADO.md\` para el caso \`${preparedCaseId}\`? Esto no enviará documentos, no los firmará ni los cargará en un portal. Responde sí o no.`;
      finalText = `${finalText}\n\n${question}`;
      session.pendingApproval = { accion: "simular_envio", casoId: preparedCaseId, estado: "esperando_confirmacion", creadaEnTurno: session.turn, resultadoEjecucion: "no_ejecutada" };
    }
    session.llmMessages = conversation.filter(item => item.role !== "system");
    session.llmMessages.push({ role: "assistant", content: finalText });
    session.messages.push({ role: "assistant", content: finalText, createdAt: new Date().toISOString(), tools: visibleCalls, needsConfirmation: Boolean(preparedCaseId) });
    return { reply: finalText, toolCalls: visibleCalls, needsConfirmation: session.pendingApproval?.estado === "esperando_confirmacion", sessionId };
  }

  private async loadSystemPrompt(): Promise<string> {
    const promptPath = path.join(this.projectRoot, "modulo", "agent.md");
    const knowledgePath = path.join(this.projectRoot, "modulo", "skill", "registro-proveedor", "SKILL.md");
    const [prompt, knowledge] = await Promise.all([
      readFile(promptPath, "utf8").then(stripFrontmatter).catch(() => "Eres un agente de registro de proveedores. Sigue las reglas de seguridad del sistema."),
      readFile(knowledgePath, "utf8").then(stripFrontmatter).catch(() => ""),
    ]);
    return `${prompt}\n\n## Conocimiento autorizado del proceso\n${knowledge}`;
  }
}

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---\n")) return markdown.trim();
  const end = markdown.indexOf("\n---\n", 4);
  return end === -1 ? markdown.trim() : markdown.slice(end + 5).trim();
}
