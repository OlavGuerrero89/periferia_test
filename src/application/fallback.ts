export function extractCaseId(message: string): string | undefined {
  const match = message.match(/\b(?:procesa|prepara)\s+(?:el\s+)?caso\s+["“]?([a-z0-9][a-z0-9-]{0,79})/i);
  return match?.[1];
}

export function getProviderGuidance(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/OPENAI_API_KEY/i.test(message)) return "El modelo no está configurado porque falta OPENAI_API_KEY en el servidor. Revisa la variable de entorno en Render.";
  if (/credencial/i.test(message)) return "El proveedor rechazó la credencial. Revisa que OPENAI_API_KEY en Render corresponda a una clave activa de la plataforma API.";
  if (/límite de solicitudes|cuota|429/i.test(message)) return "El proveedor alcanzó un límite temporal o de cuota. Espera y vuelve a intentarlo; si persiste, revisa el uso y los límites de la API.";
  return "El proveedor de lenguaje no está disponible en este momento. Puedes volver a intentarlo más tarde.";
}

export function buildFallbackReply(error: unknown, executedTools: readonly { name: string }[]): string {
  const guidance = getProviderGuidance(error);

  const execution = executedTools.length === 0
    ? "No ejecuté herramientas ni preparé archivos en este turno."
    : `Estas herramientas sí se ejecutaron y aparecen en el historial: ${executedTools.map((tool) => tool.name).join(", ")}. No ejecuté más acciones después del fallo del modelo.`;

  const nextStep = "Para procesar un caso sin modelo, escribe `Procesa el caso <id>`; usaré las herramientas deterministas del módulo y seguiré exigiendo confirmación antes de crear ENVIO-SIMULADO.md.";
  return `Modo de respaldo determinista: ${guidance}\n\n${execution} ${nextStep} La sesión sigue disponible.`;
}
