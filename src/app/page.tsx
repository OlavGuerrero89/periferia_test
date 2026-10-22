"use client";

import { FormEvent, useState } from "react";

type ToolCall = { name: string; arguments: unknown; ok: boolean; summary: string };
type Message = { role: "user" | "assistant"; content: string; tools?: ToolCall[]; needsConfirmation?: boolean; mode?: "model" | "fallback" | "system" };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hola. Puedo leer una solicitud, mapear sus campos, generar el formulario y preparar un paquete para revisión. Dime, por ejemplo: ‘Procesa el caso co-industrias-delta’." }]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setError("");
    setMessages(previous => [...previous, { role: "user", content: message }]);
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, ...(sessionId ? { sessionId } : {}) }),
      });
      const data = await response.json() as { sessionId?: string; reply?: string; toolCalls?: ToolCall[]; needsConfirmation?: boolean; mode?: Message["mode"]; error?: { message?: string } };
      if (data.sessionId) setSessionId(data.sessionId);
      if (!response.ok) throw new Error(data.reply ?? data.error?.message ?? "No se pudo procesar el mensaje.");
      setMessages(previous => [...previous, { role: "assistant", content: data.reply ?? "", tools: data.toolCalls ?? [], needsConfirmation: data.needsConfirmation, mode: data.mode }]);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error de conexión.";
      setError(text);
      setMessages(previous => [...previous, { role: "assistant", content: `No pude procesar el mensaje: ${text}` }]);
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 20, fontFamily: "system-ui, sans-serif", color: "#172033" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ color: "#5b46d6", fontWeight: 700, marginBottom: 4 }}>PERIFERIA · REGISTRO DE PROVEEDORES</p>
        <h1 style={{ margin: "0 0 8px", fontSize: 30 }}>Asistente de preparación</h1>
        <p style={{ color: "#596579", margin: 0 }}>Prepara formularios y paquetes para revisión humana. No firma, no envía y no carga documentos.</p>
      </header>
      <section aria-label="Conversación" style={{ border: "1px solid #d9deea", borderRadius: 12, padding: 16, minHeight: 360, background: "#fff" }}>
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} style={{ marginBottom: 18, padding: 14, borderRadius: 10, background: message.role === "user" ? "#f0efff" : "#f7f8fb", borderLeft: message.needsConfirmation ? "4px solid #d97706" : undefined }}>
            <strong>{message.role === "user" ? "Tú" : "Agente"}</strong>
            {message.mode === "fallback" && <strong style={{ color: "#8a4b08", marginLeft: 10 }}>Respaldo determinista</strong>}
            {message.needsConfirmation && <strong style={{ color: "#9a4d00", marginLeft: 10 }}>Confirmación pendiente</strong>}
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, margin: "8px 0 0" }}>{message.content}</p>
            {message.tools?.map((tool, toolIndex) => (
              <details key={`${tool.name}-${toolIndex}`} style={{ marginTop: 12, border: "1px solid #d9deea", borderRadius: 8, padding: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 650 }}>{tool.ok ? "✓" : "!"} {tool.name} — {tool.summary}</summary>
                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, color: "#596579" }}>{JSON.stringify(tool.arguments, null, 2)}</pre>
              </details>
            ))}
          </article>
        ))}
        {busy && <p role="status">El agente está trabajando…</p>}
        {error && <p role="alert" style={{ color: "#a61b1b" }}>{error}</p>}
      </section>
      <form onSubmit={submit} style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <label htmlFor="message" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>Mensaje</label>
        <input id="message" value={input} onChange={event => setInput(event.target.value)} placeholder="Ej.: prepara el paquete de co-industrias-delta" disabled={busy} style={{ flex: 1, padding: "13px 14px", border: "1px solid #b8c0d0", borderRadius: 8, fontSize: 15 }} />
        <button type="submit" disabled={busy || !input.trim()} style={{ padding: "0 20px", border: 0, borderRadius: 8, background: busy ? "#9295a3" : "#5142bd", color: "white", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>{busy ? "Enviando…" : "Enviar"}</button>
      </form>
      <footer style={{ fontSize: 12, color: "#697386", marginTop: 10 }}>Sesiones en memoria: se pierden al reiniciar el proceso. No introduzcas secretos ni datos reales.</footer>
    </main>
  );
}
