import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolContext } from "@/domain/types";
import { buildPackage, generateForm } from "@/infrastructure/filesystem/artifacts";
import { getSupportStatuses, loadCase, mapFields } from "@/infrastructure/filesystem/case-data";
import { resolveInside } from "@/infrastructure/filesystem/paths";
import { simular_envio } from "@/tools/proveedor";

const roots: string[] = [];

async function setup(): Promise<ToolContext> {
  const root = await mkdtemp(path.join(os.tmpdir(), "periferia-test-"));
  roots.push(root);
  const fixtureRoot = "fixtures/demo/reto-01";
  await cp(path.join(process.cwd(), fixtureRoot), path.join(root, fixtureRoot), { recursive: true });
  return { projectRoot: root, fixtureRoot, sessionId: "test-session", now: new Date("2026-10-21T15:00:00.000Z") };
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe("flujo de herramientas de proveedor", () => {
  it("mapea campos con procedencia y deja vacíos los faltantes en Excel", async () => {
    const ctx = await setup();
    const data = await loadCase(ctx, "demo-sintetica");
    const mapped = mapFields(data);
    expect(mapped.filter(item => item.resolucion.estado === "lleno")).toHaveLength(6);
    expect(mapped.find(item => item.campo.etiqueta === "Razón social")?.resolucion.origen).toEqual({ archivo: "repositorio/maestro.json", ruta: "razon_social" });
    expect(mapped.find(item => item.campo.etiqueta.startsWith("Código"))?.resolucion.estado).toBe("faltante");

    const artifact = await generateForm(data, ctx);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(resolveInside(ctx.projectRoot, artifact.ruta));
    const sheet = workbook.getWorksheet("Formulario");
    expect(sheet?.getCell("B1").value).toBe("Empresa Sintética de Prueba S.A.S.");
    expect(sheet?.getCell("B7").value).toBeNull();
    expect(sheet?.getCell("A1").value).toBe("Razón social");
    const packageResult = await buildPackage(data, ctx, await getSupportStatuses(data, ctx));
    expect(packageResult.state.listoParaFirma).toBe(true);
    expect(packageResult.state.pendientes).toContain("Código de certificación inexistente: faltante");
  });

  it("no devuelve datos bancarios si la plantilla no los solicita", async () => {
    const ctx = await setup();
    const templatePath = path.join(ctx.projectRoot, ctx.fixtureRoot ?? "", "casos/demo-sintetica/plantilla-celdas.json");
    const fields = JSON.parse(await readFile(templatePath, "utf8")) as Array<Record<string, unknown>>;
    await writeFile(templatePath, JSON.stringify(fields.filter(item => item.etiqueta !== "Cuenta bancaria")), "utf8");
    const mapped = mapFields(await loadCase(ctx, "demo-sintetica"));
    expect(mapped.some(item => /cuenta bancaria/i.test(item.campo.etiqueta))).toBe(false);
    expect(JSON.stringify(mapped)).not.toContain("000000000000000000");
  });

  it("marca el identificador extranjero y genera un PDF", async () => {
    const ctx = await setup();
    const data = await loadCase(ctx, "demo-pdf-sintetica");
    const tax = mapFields(data).find(item => item.campo.etiqueta === "Identificación tributaria")?.resolucion;
    expect(tax?.estado).toBe("requiere_confirmacion");
    expect(tax?.nota).toBe("identificador extranjero");
    const artifact = await generateForm(data, ctx);
    const pdf = await PDFDocument.load(await readFile(resolveInside(ctx.projectRoot, artifact.ruta)));
    expect(artifact.formato).toBe("pdf");
    expect(pdf.getPageCount()).toBeGreaterThan(0);
  });

  it("no resuelve automáticamente la etiqueta tributaria genérica aunque exista NIT", async () => {
    const ctx = await setup();
    const requestPath = path.join(ctx.projectRoot, ctx.fixtureRoot ?? "", "casos/demo-pdf-sintetica/solicitud.json");
    const request = JSON.parse(await readFile(requestPath, "utf8")) as Record<string, unknown>;
    request.pais = "CO";
    await writeFile(requestPath, JSON.stringify(request), "utf8");
    const tax = mapFields(await loadCase(ctx, "demo-pdf-sintetica")).find(item => item.campo.etiqueta === "Identificación tributaria")?.resolucion;
    expect(tax?.estado).toBe("requiere_confirmacion");
    expect(tax?.nota).toContain("NIT colombiano");
  });

  it("prepara valores para portal sin iniciar sesión", async () => {
    const ctx = await setup();
    const data = await loadCase(ctx, "demo-portal-sintetica");
    const artifact = await generateForm(data, ctx);
    const markdown = await readFile(resolveInside(ctx.projectRoot, artifact.ruta), "utf8");
    expect(markdown).toContain("El portal no se automatiza");
    expect(markdown).toContain("Empresa Sintética de Prueba S.A.S.");
  });

  it("bloquea el paquete ante soporte vencido y excluye datos bancarios del correo", async () => {
    const ctx = await setup();
    ctx.now = new Date("2031-01-01T12:00:00.000Z");
    const data = await loadCase(ctx, "demo-sintetica");
    const supports = await getSupportStatuses(data, ctx);
    expect(supports.every(item => item.estado === "vencido")).toBe(true);
    const pack = await buildPackage(data, ctx, supports);
    expect(pack.state.listoParaFirma).toBe(false);
    const email = await readFile(path.join(ctx.projectRoot, "out/demo-sintetica/paquete/borrador-correo.md"), "utf8");
    expect(email).not.toContain("000000000000000000");
    expect(await readdir(path.join(ctx.projectRoot, "out/demo-sintetica/paquete/soportes"))).toHaveLength(0);
  });

  it("no crea envío simulado sin aprobación confiable", async () => {
    const ctx = await setup();
    const result = await simular_envio.execute({ casoId: "demo-sintetica" }, ctx);
    expect(result.ok).toBe(false);
    await expect(readFile(path.join(ctx.projectRoot, "out/demo-sintetica/ENVIO-SIMULADO.md"))).rejects.toThrow();
  });

  it("rechaza IDs con traversal y rutas absolutas", () => {
    expect(() => resolveInside("/tmp/root", "../outside")).toThrow();
    expect(() => resolveInside("/tmp/root", "/etc/passwd")).toThrow();
  });

  it("rechaza un enlace simbólico de salida que apunte fuera del proyecto", async () => {
    const ctx = await setup();
    const outside = await mkdtemp(path.join(os.tmpdir(), "periferia-outside-"));
    roots.push(outside);
    await mkdir(path.join(ctx.projectRoot, "out"), { recursive: true });
    await symlink(outside, path.join(ctx.projectRoot, "out/demo-sintetica"), "dir");
    const data = await loadCase(ctx, "demo-sintetica");
    await expect(generateForm(data, ctx)).rejects.toThrow();
    expect(await readdir(outside)).toHaveLength(0);
  });
});
