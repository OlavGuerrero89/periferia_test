import { AgentApplication } from "@/application/agent-loop";
import { OpenAIAdapter, type LlmAdapter } from "@/infrastructure/llm/adapter";

let application: AgentApplication | undefined;

export function getApplication(): AgentApplication {
  if (!application) {
    const adapter: LlmAdapter = process.env.OPENAI_API_KEY
      ? new OpenAIAdapter()
      : {
          provider: "openai",
          model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
          async complete() { throw new Error("Configura OPENAI_API_KEY en el servidor para habilitar el chat. La demo local no requiere esa clave."); },
        };
    application = new AgentApplication(adapter, process.env.PROJECT_ROOT ?? process.cwd());
  }
  return application;
}

export function setApplicationForTests(value: AgentApplication | undefined): void { application = value; }

export async function processRequest(sessionId: string, message: string) {
  return getApplication().process(sessionId, message);
}
