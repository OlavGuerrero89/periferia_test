import { z } from "zod";
import type { ProviderTool } from "@/tools/proveedor";

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
}

export interface LlmToolCall { id: string; name: string; arguments: unknown }
export interface LlmReply { text: string; toolCalls: LlmToolCall[]; inputTokens?: number; outputTokens?: number }
export interface LlmAdapter {
  readonly provider: string;
  readonly model: string;
  complete(messages: LlmMessage[], tools: readonly ProviderTool[], signal?: AbortSignal): Promise<LlmReply>;
}

const OpenAIResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.union([z.string(), z.null()]).optional(),
      tool_calls: z.array(z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({ name: z.string(), arguments: z.string() }),
      })).optional(),
    }),
  })).min(1),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).optional(),
});

export class OpenAIAdapter implements LlmAdapter {
  readonly provider = "openai";
  readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey = process.env.OPENAI_API_KEY ?? "", model = process.env.OPENAI_MODEL ?? "gpt-6-luna") {
    if (!apiKey) throw new Error("Falta OPENAI_API_KEY en el entorno del servidor.");
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(messages: LlmMessage[], tools: readonly ProviderTool[], signal?: AbortSignal): Promise<LlmReply> {
    const payload = {
      model: this.model,
      max_completion_tokens: boundedInteger(process.env.LLM_MAX_OUTPUT_TOKENS, 1200, 128, 4096),
      messages,
      tools: tools.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.args, { target: "draft-7" }),
        },
      })),
      tool_choice: "auto",
      parallel_tool_calls: false,
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: signal ?? AbortSignal.timeout(boundedInteger(process.env.LLM_TIMEOUT_MS, 30000, 1000, 120000)),
      cache: "no-store",
    });
    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) throw new Error("El proveedor rechazó la credencial configurada.");
      if (status === 429) throw new Error("El proveedor alcanzó su límite de solicitudes; intenta de nuevo en unos segundos.");
      if (status >= 500) throw new Error("El proveedor de lenguaje no está disponible temporalmente.");
      throw new Error(`La solicitud al proveedor falló (HTTP ${status}).`);
    }
    const payloadUnknown: unknown = await response.json();
    const parsed = OpenAIResponseSchema.safeParse(payloadUnknown);
    if (!parsed.success) throw new Error("El proveedor devolvió una respuesta con formato inesperado.");
    const message = parsed.data.choices[0]?.message;
    if (!message) throw new Error("El proveedor no devolvió una respuesta.");
    const toolCalls = (message.tool_calls ?? []).map(call => {
      let args: unknown;
      try { args = JSON.parse(call.function.arguments) as unknown; }
      catch { args = null; }
      return { id: call.id, name: call.function.name, arguments: args };
    });
    return { text: message.content ?? "", toolCalls, inputTokens: parsed.data.usage?.prompt_tokens, outputTokens: parsed.data.usage?.completion_tokens };
  }
}
