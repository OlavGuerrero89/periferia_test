import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolContext } from "@/domain/types";
import { buildPackage, generateForm } from "@/infrastructure/filesystem/artifacts";
import { getSupportStatuses, loadCase, mapFields } from "@/infrastructure/filesystem/case-data";
import { resolveInside } from "@/infrastructure/filesystem/paths";

const roots: string[] = [];
const caseIds = ["co-industrias-delta", "ec-corp-andina", "hn-agroexport-sula", "pa-logistica-istmo"];

async function setup(): Promise<ToolContext> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "periferia-cases-"));
  roots.push(projectRoot);
  const fixtureRoot = "fixtures/reto-01";
  await cp(path.join(process.cwd(), fixtureRoot), path.join(projectRoot, fixtureRoot), { recursive: true });
  return { projectRoot, fixtureRoot, sessionId: "acceptance-test", now: new Date("2026-10-23T12:00:00.000Z") };
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe("casos de aceptación del PRD", () => {
  it("procesa los cuatro casos, respeta las hojas y celdas Excel y prepara artefactos válidos", async () => {
    const ctx = await setup();

    for (const casoId of caseIds) {
      const data = await loadCase(ctx, casoId);
      const supports = await getSupportStatuses(data, ctx);
      expect(supports.every(item => item.estado === "presente"), casoId).toBe(true);

      const form = await generateForm(data, ctx);
      if (form.formato === "xlsx") {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(resolveInside(ctx.projectRoot, form.ruta));
        for (const { campo, resolucion } of mapFields(data)) {
          const sheet = workbook.getWorksheet(campo.hoja ?? "Formulario");
          expect(sheet, `${casoId}: hoja ${campo.hoja}`).toBeDefined();
          if (campo.celdaEtiqueta) expect(sheet?.getCell(campo.celdaEtiqueta).value).toBe(campo.etiqueta);
          if (campo.celdaValor) expect(sheet?.getCell(campo.celdaValor).value).toEqual(resolucion.estado === "lleno" ? resolucion.valor : null);
        }
      } else if (form.formato === "pdf") {
        const pdf = await PDFDocument.load(await readFile(resolveInside(ctx.projectRoot, form.ruta)));
        expect(pdf.getPageCount()).toBeGreaterThan(0);
      } else {
        const values = await readFile(resolveInside(ctx.projectRoot, form.ruta), "utf8");
        expect(values).toContain("El portal no se automatiza");
        expect(values).toContain(data.normalized.cliente);
      }

      const pack = await buildPackage(data, ctx, supports);
      expect(pack.state.listoParaFirma, casoId).toBe(true);
      expect(await readFile(path.join(ctx.projectRoot, "out", casoId, "paquete", "checklist.md"), "utf8")).toContain("listo para firma");
      expect(await readFile(path.join(ctx.projectRoot, "out", casoId, "paquete", "borrador-correo.md"), "utf8")).toContain("Borrador interno");
    }
  });
});
