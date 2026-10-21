import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ArtefactoGenerado, EstadoPaquete, ResultadoSoporte, ToolContext } from "../../domain/types";
import { mapFields, type CaseData } from "./case-data";
import { assertRealPathInside, assertSafeWriteTarget, ensureOutputDirectory, resolveFixtureRoot, resolveInside } from "./paths";

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function getOutputRoot(ctx: ToolContext, caseId: string): string {
  return resolveInside(ctx.projectRoot, "out", caseId);
}

async function generateExcel(data: CaseData, ctx: ToolContext): Promise<ArtefactoGenerado> {
  const outputDir = getOutputRoot(ctx, data.normalized.casoId);
  await ensureOutputDirectory(ctx.projectRoot, outputDir);
  const outputPath = await assertSafeWriteTarget(ctx.projectRoot, resolveInside(outputDir, "formulario.xlsx"));
  const optionalTemplatePath = resolveInside(data.caseDir, "plantilla.xlsx");
  const workbook = new ExcelJS.Workbook();
  let sourceTemplateExists = false;
  try {
    const safeTemplatePath = await assertRealPathInside(data.caseDir, optionalTemplatePath);
    const bytes = await readFile(safeTemplatePath);
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    sourceTemplateExists = true;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw new Error("La plantilla Excel original no se pudo leer o está corrupta.");
    workbook.addWorksheet("Formulario");
  }
  const resolutions = mapFields(data);
  for (const { campo, resolucion } of resolutions) {
    const sheetName = campo.hoja ?? "Formulario";
    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      if (workbook.worksheets.length === 1 && workbook.worksheets[0]?.name === "Formulario" && !campo.hoja) {
        sheet = workbook.worksheets[0];
      } else {
        throw new Error(`La hoja “${sheetName}” indicada por la plantilla no existe.`);
      }
    }
    if (!sourceTemplateExists && campo.celdaEtiqueta) {
      sheet.getCell(campo.celdaEtiqueta).value = campo.etiqueta;
    } else if (sourceTemplateExists && campo.celdaEtiqueta && !sheet.getCell(campo.celdaEtiqueta).value) {
      throw new Error(`La celda de etiqueta ${campo.celdaEtiqueta} está vacía en la plantilla original.`);
    }
    const output = sheet.getCell(campo.celdaValor ?? `B${campo.orden + 1}`);
    output.value = resolucion.estado === "lleno" ? (resolucion.valor as ExcelJS.CellValue) : null;
  }
  await workbook.xlsx.writeFile(outputPath);
  const verify = new ExcelJS.Workbook();
  await verify.xlsx.readFile(outputPath);
  if (verify.worksheets.length === 0) throw new Error("El archivo Excel generado no se pudo verificar.");
  return { ruta: path.relative(ctx.projectRoot, outputPath).split(path.sep).join("/"), formato: "xlsx" };
}

async function generatePdf(data: CaseData, ctx: ToolContext): Promise<ArtefactoGenerado> {
  const outputDir = getOutputRoot(ctx, data.normalized.casoId);
  await ensureOutputDirectory(ctx.projectRoot, outputDir);
  const outputPath = await assertSafeWriteTarget(ctx.projectRoot, resolveInside(outputDir, "formulario.pdf"));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  const resolutions = mapFields(data);
  let y = 740;
  page.drawText(`Formulario de registro de proveedor — ${data.normalized.cliente}`, { x: 48, y, size: 13, font: bold, color: rgb(0.12, 0.18, 0.27) });
  y -= 32;
  for (const { campo, resolucion } of resolutions) {
    if (y < 80) { page = pdf.addPage([612, 792]); y = 740; }
    const status = resolucion.estado === "lleno" ? displayValue(resolucion.valor) : resolucion.estado === "faltante" ? "[PENDIENTE: dato no disponible]" : `[REQUIERE CONFIRMACIÓN${resolucion.nota ? `: ${resolucion.nota}` : ""}]`;
    page.drawText(campo.etiqueta.slice(0, 75), { x: 48, y, size: 10, font: bold });
    y -= 15;
    page.drawText(status.slice(0, 100), { x: 60, y, size: 10, font, maxWidth: 500 });
    y -= 24;
  }
  const bytes = await pdf.save();
  await writeFile(outputPath, bytes);
  const verify = await PDFDocument.load(await readFile(outputPath));
  if (verify.getPageCount() < 1) throw new Error("El PDF generado no se pudo verificar.");
  return { ruta: path.relative(ctx.projectRoot, outputPath).split(path.sep).join("/"), formato: "pdf" };
}

async function generatePortal(data: CaseData, ctx: ToolContext): Promise<ArtefactoGenerado> {
  const outputDir = getOutputRoot(ctx, data.normalized.casoId);
  await ensureOutputDirectory(ctx.projectRoot, outputDir);
  const outputPath = await assertSafeWriteTarget(ctx.projectRoot, resolveInside(outputDir, "valores-portal.md"));
  const resolutions = mapFields(data);
  const lines = [
    `# Datos para copiar en el portal — ${data.normalized.cliente}`,
    "",
    "> El portal no se automatiza. Una persona debe iniciar sesión y revisar cada dato antes de copiarlo.",
    "",
    "| Campo | Estado | Valor disponible | Fuente |",
    "|---|---|---|---|",
    ...resolutions.map(({ campo, resolucion }) => `| ${campo.etiqueta.replaceAll("|", "\\|")} | ${resolucion.estado} | ${resolucion.estado === "lleno" ? displayValue(resolucion.valor).replaceAll("|", "\\|") : "—"} | ${resolucion.origen ? `${resolucion.origen.archivo}:${resolucion.origen.ruta}` : "—"} |`),
  ];
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  return { ruta: path.relative(ctx.projectRoot, outputPath).split(path.sep).join("/"), formato: "markdown" };
}

export async function generateForm(data: CaseData, ctx: ToolContext): Promise<ArtefactoGenerado> {
  if (data.normalized.formato === "xlsx") return generateExcel(data, ctx);
  if (data.normalized.formato === "pdf") return generatePdf(data, ctx);
  return generatePortal(data, ctx);
}

export async function buildPackage(data: CaseData, ctx: ToolContext, supports: ResultadoSoporte[]): Promise<{ artifacts: ArtefactoGenerado[]; state: EstadoPaquete }> {
  const caseOut = getOutputRoot(ctx, data.normalized.casoId);
  const packageDir = resolveInside(caseOut, "paquete");
  const supportDir = resolveInside(packageDir, "soportes");
  await ensureOutputDirectory(ctx.projectRoot, packageDir);
  await ensureOutputDirectory(ctx.projectRoot, supportDir);
  const form = await generateForm(data, ctx);
  const formSource = resolveInside(ctx.projectRoot, form.ruta);
  const formName = path.basename(formSource);
  await copyFile(formSource, await assertSafeWriteTarget(ctx.projectRoot, resolveInside(packageDir, formName)));
  for (const support of supports) {
    if (support.estado !== "presente" || !support.archivo) continue;
    const supportRoot = resolveInside(resolveFixtureRoot(ctx), "repositorio", "soportes");
    const source = await assertRealPathInside(supportRoot, resolveInside(supportRoot, support.archivo));
    const safeName = path.basename(support.archivo);
    await copyFile(source, await assertSafeWriteTarget(ctx.projectRoot, resolveInside(supportDir, safeName)));
  }
  const resolutions = mapFields(data);
  const fieldLines = resolutions.map(({ campo, resolucion }) => `- ${campo.etiqueta}: **${resolucion.estado}**${resolucion.estado === "lleno" && resolucion.origen ? ` (fuente: ${resolucion.origen.archivo} → ${resolucion.origen.ruta})` : resolucion.nota ? ` — ${resolucion.nota}` : ""}`);
  const supportLines = supports.map(item => `- ${item.tipo}: **${item.estado}**${item.archivo ? ` (${item.archivo})` : ""}${item.vigenciaHasta ? ` (vigente hasta ${item.vigenciaHasta})` : ""}${item.nota ? ` — ${item.nota}` : ""}`);
  const blockedSupports = supports.filter(item => item.estado !== "presente").map(item => `${item.tipo}: ${item.estado}`);
  const state: EstadoPaquete = {
    listoParaFirma: blockedSupports.length === 0,
    bloqueos: blockedSupports,
    pendientes: resolutions.filter(item => item.resolucion.estado !== "lleno").map(item => `${item.campo.etiqueta}: ${item.resolucion.estado}`),
  };
  const checklist = [
    `# Checklist de revisión — ${data.normalized.cliente}`,
    "",
    `**Estado de soportes y formulario:** ${state.listoParaFirma ? "listo para firma" : "no listo para firma"}`,
    "",
    "## Campos",
    ...fieldLines,
    "",
    "## Soportes exigidos",
    ...(supportLines.length ? supportLines : ["- No se exigieron soportes."]),
    "",
    "## Bloqueos y pendientes",
    ...(state.bloqueos.length || state.pendientes.length ? [...state.bloqueos.map(value => `- Bloqueo: ${value}`), ...state.pendientes.map(value => `- Pendiente: ${value}`)] : ["- Ninguno."]),
    "",
    "> Este estado prepara la revisión humana; no significa que el documento esté firmado o enviado.",
  ];
  await writeFile(await assertSafeWriteTarget(ctx.projectRoot, resolveInside(packageDir, "checklist.md")), `${checklist.join("\n")}\n`, "utf8");
  const email = [
    `Asunto: Documentación para registro de proveedor — ${data.normalized.cliente}`,
    "",
    "Cordial saludo,",
    "",
    "Adjuntamos para revisión la documentación disponible para el proceso de registro como proveedor.",
    "El formulario y los soportes deben ser revisados y aprobados por las personas responsables antes de cualquier envío.",
    "",
    "Quedamos atentos a sus comentarios.",
    "",
    "Cordialmente,",
    "Equipo administrativo",
    "",
    "> Borrador interno. No incluye datos bancarios ni se ha enviado al cliente.",
  ];
  await writeFile(await assertSafeWriteTarget(ctx.projectRoot, resolveInside(packageDir, "borrador-correo.md")), `${email.join("\n")}\n`, "utf8");
  const artifacts: ArtefactoGenerado[] = [
    { ruta: path.relative(ctx.projectRoot, packageDir).split(path.sep).join("/"), formato: "directorio" },
    { ruta: path.relative(ctx.projectRoot, resolveInside(packageDir, formName)).split(path.sep).join("/"), formato: form.formato },
    { ruta: path.relative(ctx.projectRoot, resolveInside(packageDir, "checklist.md")).split(path.sep).join("/"), formato: "markdown" },
    { ruta: path.relative(ctx.projectRoot, resolveInside(packageDir, "borrador-correo.md")).split(path.sep).join("/"), formato: "markdown" },
  ];
  return { artifacts, state };
}
