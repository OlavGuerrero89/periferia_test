import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CampoSolicitado, CasoNormalizado, Formato, Pais, ResultadoSoporte, ResolucionCampo, ToolContext } from "../../domain/types";
import { assertRealPathInside, resolveFixtureRoot, resolveInside, validateCaseId } from "./paths";

const SolicitudSchema = z.object({
  id: z.string().optional(),
  de: z.string().optional(),
  asunto: z.string().min(1),
  fecha: z.string().optional(),
  pais: z.enum(["CO", "EC", "PE", "PA", "HN"]),
  cliente: z.string().min(1),
  cuerpo: z.string().optional().default(""),
  formato: z.enum(["xlsx", "pdf", "portal"]),
  adjuntos: z.array(z.string()).optional().default([]),
});

const RecordSchema = z.record(z.string(), z.unknown());

export function normalizeLabel(label: string): string {
  return label.trim().toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function ensureRecord(value: unknown, description: string): Record<string, unknown> {
  const parsed = RecordSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${description} debe ser un objeto JSON.`);
  return parsed.data;
}

async function readJson<T>(filePath: string, parse: (value: unknown) => T, boundaryRoot: string): Promise<T> {
  let raw: string;
  try {
    const safePath = await assertRealPathInside(boundaryRoot, filePath);
    raw = await readFile(safePath, "utf8");
  } catch {
    throw new Error(`No se encontró el archivo requerido: ${path.basename(filePath)}.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`El archivo ${path.basename(filePath)} no contiene JSON válido.`);
  }
  return parse(data);
}

function listFromTemplate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = ensureRecord(value, "La plantilla");
  if (Array.isArray(record.campos)) return record.campos;
  throw new Error("La plantilla no contiene una lista de campos válida.");
}

function parseFields(formato: Formato, template: unknown): CampoSolicitado[] {
  const fields = listFromTemplate(template).map((raw, index) => {
    const item = ensureRecord(raw, "Un campo de la plantilla");
    const etiqueta = typeof item.etiqueta === "string" ? item.etiqueta.trim() : "";
    if (!etiqueta) throw new Error(`El campo ${index + 1} de la plantilla no tiene etiqueta.`);
    if (item.obligatorio !== undefined && typeof item.obligatorio !== "boolean") throw new Error(`El indicador obligatorio del campo “${etiqueta}” no es válido.`);
    const obligatorio = item.obligatorio ?? true;
    if (formato === "xlsx") {
      const hoja = typeof item.hoja === "string" ? item.hoja : "";
      const celdaEtiqueta = typeof item.celda_etiqueta === "string" ? item.celda_etiqueta : "";
      const celdaValor = typeof item.celda_valor === "string" ? item.celda_valor : "";
      if (!hoja || !/^[A-Z]{1,3}[1-9]\d{0,6}$/i.test(celdaEtiqueta) || !/^[A-Z]{1,3}[1-9]\d{0,6}$/i.test(celdaValor)) {
        throw new Error(`La ubicación Excel del campo “${etiqueta}” no es válida.`);
      }
      return { etiqueta, obligatorio, hoja, celdaEtiqueta, celdaValor, orden: index };
    }
    return { etiqueta, obligatorio, orden: index };
  });
  const labels = fields.map(field => normalizeLabel(field.etiqueta));
  if (new Set(labels).size !== labels.length) throw new Error("La plantilla contiene etiquetas duplicadas.");
  if (formato === "xlsx") {
    const cells = fields.flatMap(field => [
      `${field.hoja}:${field.celdaEtiqueta?.toLocaleUpperCase("en-US")}`,
      `${field.hoja}:${field.celdaValor?.toLocaleUpperCase("en-US")}`,
    ]);
    if (new Set(cells).size !== cells.length) throw new Error("La plantilla reutiliza una celda de etiqueta o valor.");
  }
  return fields;
}

function parseSupports(value: unknown): string[] {
  const list = Array.isArray(value) ? value : ensureRecord(value, "Soportes exigidos").soportes;
  if (!Array.isArray(list)) throw new Error("La lista de soportes exigidos no es válida.");
  return list.map(item => {
    if (typeof item === "string" && item.trim()) return item.trim();
    const record = ensureRecord(item, "Un soporte exigido");
    if (typeof record.tipo !== "string" || !record.tipo.trim()) throw new Error("Un soporte exigido no tiene un tipo válido.");
    return record.tipo.trim();
  });
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export interface CaseData {
  normalized: CasoNormalizado;
  request: z.infer<typeof SolicitudSchema>;
  master: Record<string, unknown>;
  glossary: Record<string, unknown>;
  supportIndex: Array<{ tipo: string; archivo?: string; vigencia_hasta?: string; pais_emisor?: string }>;
  caseDir: string;
}

export async function loadCase(ctx: ToolContext, caseIdInput: string): Promise<CaseData> {
  const caseId = validateCaseId(caseIdInput);
  const fixturesRoot = resolveFixtureRoot(ctx);
  const caseDir = resolveInside(fixturesRoot, "casos", caseId);
  const requestRaw = await readJson(resolveInside(caseDir, "solicitud.json"), value => {
    const result = SolicitudSchema.safeParse(value);
    if (!result.success) throw new Error("La solicitud no cumple el contrato requerido.");
    return result.data;
  }, fixturesRoot);
  const templateFile = requestRaw.formato === "xlsx" ? "plantilla-celdas.json" : requestRaw.formato === "pdf" ? "plantilla-campos.json" : "plantilla-campos.json";
  const template = await readJson(resolveInside(caseDir, templateFile), value => value, fixturesRoot);
  const fields = parseFields(requestRaw.formato, template);
  const supportsRaw = await readJson(resolveInside(caseDir, "soportes-exigidos.json"), value => value, fixturesRoot);
  const master = ensureRecord(await readJson(resolveInside(fixturesRoot, "repositorio", "maestro.json"), value => value, fixturesRoot), "El maestro");
  const glossary = ensureRecord(await readJson(resolveInside(fixturesRoot, "glosario-campos.json"), value => value, fixturesRoot), "El glosario");
  const indexRaw = await readJson(resolveInside(fixturesRoot, "repositorio", "soportes", "index.json"), value => value, fixturesRoot);
  const indexList = Array.isArray(indexRaw) ? indexRaw : ensureRecord(indexRaw, "El índice de soportes").soportes;
  if (!Array.isArray(indexList)) throw new Error("El índice de soportes no contiene una lista válida.");
  const supportIndex = indexList.map(raw => {
    const entry = ensureRecord(raw, "Una entrada del índice de soportes");
    if (typeof entry.tipo !== "string") throw new Error("Una entrada del índice de soportes no tiene tipo.");
    if (entry.vigencia_hasta !== undefined && (typeof entry.vigencia_hasta !== "string" || !isIsoDate(entry.vigencia_hasta))) throw new Error(`La vigencia del soporte “${entry.tipo}” no es una fecha ISO válida.`);
    return {
      tipo: entry.tipo,
      ...(typeof entry.archivo === "string" ? { archivo: entry.archivo } : {}),
      ...(typeof entry.vigencia_hasta === "string" ? { vigencia_hasta: entry.vigencia_hasta } : {}),
      ...(typeof entry.pais_emisor === "string" ? { pais_emisor: entry.pais_emisor } : {}),
    };
  });
  const normalized: CasoNormalizado = {
    casoId: caseId,
    pais: requestRaw.pais as Pais,
    cliente: requestRaw.cliente,
    formato: requestRaw.formato as Formato,
    asunto: requestRaw.asunto,
    campos: fields,
    soportesExigidos: parseSupports(supportsRaw),
  };
  return { normalized, request: requestRaw, master, glossary, supportIndex, caseDir };
}

function getPathValue(root: Record<string, unknown>, key: string): unknown {
  let value: unknown = root;
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function glossaryCandidates(glossary: Record<string, unknown>, label: string): string[] {
  const normalizedLabel = normalizeLabel(label);
  const candidates = new Set<string>();
  for (const [key, raw] of Object.entries(glossary)) {
    if (typeof raw === "string") {
      if (normalizeLabel(key) === normalizedLabel || normalizeLabel(raw) === normalizedLabel) {
        candidates.add(normalizeLabel(key) === normalizedLabel ? raw : key);
      }
    } else if (Array.isArray(raw)) {
      if ((raw as unknown[]).some(item => typeof item === "string" && normalizeLabel(item) === normalizedLabel)) candidates.add(key);
    }
  }
  return [...candidates];
}

function findMasterKey(master: Record<string, unknown>, candidate: string): string | null {
  const normalized = normalizeLabel(candidate).replace(/ /g, "_");
  const direct = getPathValue(master, candidate) ?? getPathValue(master, normalized);
  if (direct !== undefined) return candidate;
  for (const key of Object.keys(master)) {
    if (normalizeLabel(key).replace(/ /g, "_") === normalized) return key;
  }
  return null;
}

export function mapFields(data: CaseData): Array<{ campo: CampoSolicitado; resolucion: ResolucionCampo }> {
  return data.normalized.campos.map(campo => {
    const labelNorm = normalizeLabel(campo.etiqueta);
    const taxIdentifier = /\b(nit|ruc|rtn|identificacion tributaria|numero de identificacion tributaria)\b/.test(labelNorm);
    const glossary = glossaryCandidates(data.glossary, campo.etiqueta);
    let keyCandidate = glossary.length === 1 ? glossary[0] : null;
    if (glossary.length > 1) return { campo, resolucion: { estado: "requiere_confirmacion", claveMaestro: null, valor: null, origen: null, confianza: 0.5, nota: "La etiqueta coincide con más de una clave del glosario." } };
    if (!keyCandidate && taxIdentifier) keyCandidate = "nit";
    if (!keyCandidate) keyCandidate = Object.keys(data.master).find(key => normalizeLabel(key).replace(/ /g, "_") === labelNorm.replace(/ /g, "_")) ?? null;
    const key = keyCandidate ? findMasterKey(data.master, keyCandidate) : null;
    const value = key ? getPathValue(data.master, key) : undefined;
    const usable = value !== undefined && value !== null && value !== "";
    const foreignTax = taxIdentifier && data.normalized.pais !== "CO" && key === "nit" && usable;
    if (foreignTax) {
      return { campo, resolucion: { estado: "requiere_confirmacion", claveMaestro: key, valor: value, origen: { archivo: "repositorio/maestro.json", ruta: key }, confianza: 1, nota: "identificador extranjero" } };
    }
    if (taxIdentifier && data.normalized.pais === "CO" && !/\bnit\b/.test(labelNorm) && usable) {
      return { campo, resolucion: { estado: "requiere_confirmacion", claveMaestro: key, valor: value, origen: { archivo: "repositorio/maestro.json", ruta: key ?? "nit" }, confianza: 0.7, nota: "Se propone el NIT colombiano; confirma que corresponde al campo solicitado." } };
    }
    if (!usable || !key) {
      return { campo, resolucion: { estado: "faltante", claveMaestro: key, valor: null, origen: null, confianza: 0 } };
    }
    return { campo, resolucion: { estado: "lleno", claveMaestro: key, valor: value, origen: { archivo: "repositorio/maestro.json", ruta: key }, confianza: glossary.length === 1 ? 1 : 0.8 } };
  });
}

function bogotaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function getSupportStatuses(data: CaseData, ctx: ToolContext): Promise<ResultadoSoporte[]> {
  const supportsRoot = resolveInside(resolveFixtureRoot(ctx), "repositorio", "soportes");
  const today = bogotaDate(ctx.now);
  return Promise.all(data.normalized.soportesExigidos.map(async tipo => {
    const matches = data.supportIndex.filter(entry => normalizeLabel(entry.tipo) === normalizeLabel(tipo));
    const support = matches.length === 1 ? matches[0] : undefined;
    if (!support?.archivo) return { tipo, estado: "ausente", nota: matches.length > 1 ? "Referencia de soporte ambigua." : "No existe una referencia en el índice." };
    let filePath: string;
    try { filePath = resolveInside(supportsRoot, support.archivo); } catch { return { tipo, estado: "ausente", nota: "Ruta del soporte inválida." }; }
    try {
      const safePath = await assertRealPathInside(supportsRoot, filePath);
      if (!(await stat(safePath)).isFile()) return { tipo, estado: "ausente", archivo: support.archivo };
    } catch { return { tipo, estado: "ausente", archivo: support.archivo }; }
    if (support.vigencia_hasta && support.vigencia_hasta < today) return { tipo, estado: "vencido", archivo: support.archivo, vigenciaHasta: support.vigencia_hasta };
    return { tipo, estado: "presente", archivo: support.archivo, ...(support.vigencia_hasta ? { vigenciaHasta: support.vigencia_hasta } : {}) };
  }));
}
