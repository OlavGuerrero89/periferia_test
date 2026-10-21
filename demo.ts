import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { armar_paquete, generar_formulario, leer_solicitud, mapear_campos } from "./src/tools/proveedor";
import type { ToolContext } from "./src/domain/types";

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const fixtureRoot = process.env.DATA_DIR ?? "fixtures/demo/reto-01";
  const sourceFixtures = path.resolve(projectRoot, fixtureRoot);
  const casesRoot = path.join(sourceFixtures, "casos");
  const caseIds = (await readdir(casesRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  if (caseIds.length === 0) {
    console.log(`No hay casos disponibles en ${path.relative(projectRoot, casesRoot)}; agrega los fixtures para ejecutar la demo.`);
    return;
  }
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "periferia-ai-demo-"));
  try {
    await cp(sourceFixtures, path.join(tempRoot, fixtureRoot), { recursive: true });
    const ctx: ToolContext = { projectRoot: tempRoot, fixtureRoot, sessionId: "demo-sintetica", now: new Date() };
    for (const casoId of caseIds) {
      const read = await leer_solicitud.execute({ casoId }, ctx);
      if (!read.ok) { console.log(`${casoId}: error al leer — ${read.error.mensaje}`); continue; }
      const mapping = await mapear_campos.execute({ casoId }, ctx);
      const form = await generar_formulario.execute({ casoId }, ctx);
      const pack = await armar_paquete.execute({ casoId }, ctx);
      const mapData = mapping.ok ? mapping.data as { campos: Array<{ resolucion: { estado: string } }> } : undefined;
      const formData = form.ok ? form.data as { artefactos: Array<{ ruta: string }> } : undefined;
      const packData = pack.ok ? pack.data as { estado: { listoParaFirma: boolean; bloqueos: string[] } } : undefined;
      console.log(JSON.stringify({
        casoId,
        cliente: read.data.caso.cliente,
        formato: read.data.caso.formato,
        campos: mapData?.campos.length ?? 0,
        faltantes: mapData?.campos.filter(item => item.resolucion.estado === "faltante").length ?? 0,
        requierenConfirmacion: mapData?.campos.filter(item => item.resolucion.estado === "requiere_confirmacion").length ?? 0,
        formulario: formData?.artefactos[0]?.ruta ?? (form.ok ? "generado" : form.error.mensaje),
        listoParaFirma: packData?.estado.listoParaFirma ?? false,
        bloqueos: packData?.estado.bloqueos ?? (pack.ok ? [] : [pack.error.mensaje]),
      }, null, 2));
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "La demo falló.");
  process.exitCode = 1;
});
