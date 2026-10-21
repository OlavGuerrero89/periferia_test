import type { z } from "zod";

export type Pais = "CO" | "EC" | "PE" | "PA" | "HN";
export type Formato = "xlsx" | "pdf" | "portal";
export type EstadoCampo = "lleno" | "faltante" | "requiere_confirmacion";
export type EstadoSoporte = "presente" | "ausente" | "vencido";

export interface ReferenciaOrigen {
  archivo: string;
  ruta: string;
}

export interface CampoSolicitado {
  etiqueta: string;
  obligatorio: boolean;
  hoja?: string;
  celdaEtiqueta?: string;
  celdaValor?: string;
  orden: number;
}

export interface ResolucionCampo {
  estado: EstadoCampo;
  claveMaestro: string | null;
  valor: unknown;
  origen: ReferenciaOrigen | null;
  confianza: number;
  nota?: string;
}

export interface CasoNormalizado {
  casoId: string;
  pais: Pais;
  cliente: string;
  formato: Formato;
  asunto: string;
  campos: CampoSolicitado[];
  soportesExigidos: string[];
}

export interface ResultadoSoporte {
  tipo: string;
  estado: EstadoSoporte;
  archivo?: string;
  vigenciaHasta?: string;
  nota?: string;
}

export interface EstadoPaquete {
  listoParaFirma: boolean;
  bloqueos: string[];
  pendientes: string[];
}

export interface ArtefactoGenerado {
  ruta: string;
  formato: string;
}

export type ResultadoHerramienta<T> =
  | { ok: true; data: T }
  | { ok: false; error: { codigo: string; mensaje: string } };

export interface AprobacionPendiente {
  accion: "simular_envio";
  casoId: string;
  estado: "esperando_confirmacion" | "aprobado" | "rechazado" | "expirado";
  creadaEnTurno: number;
  resultadoEjecucion: "no_ejecutada" | "completada" | "fallida";
}

export interface ToolContext {
  projectRoot: string;
  fixtureRoot?: string;
  sessionId: string;
  now: Date;
  approval?: AprobacionPendiente;
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  args: z.ZodType<TArgs>;
  execute(args: TArgs, ctx: ToolContext): Promise<ResultadoHerramienta<TResult>>;
}
