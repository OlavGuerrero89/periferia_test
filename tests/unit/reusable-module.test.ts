import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { executeTool, proveedorTools } from "@module/tools/proveedor";

describe("módulo reusable", () => {
  it("publica metadatos compatibles y los artefactos de prompt y conocimiento", async () => {
    const agent = await readFile("modulo/agent.md", "utf8");
    const skill = await readFile("modulo/skill/registro-proveedor/SKILL.md", "utf8");

    expect(agent).toContain("mode: primary");
    expect(agent).toContain("edit: deny");
    expect(agent).toContain("bash: deny");
    expect(skill).toContain("name: registro-proveedor");
    expect(agent).toContain("No inventes ni completes información");
    expect(skill).toContain("identificador extranjero");
  });

  it("expone el mismo conjunto de herramientas usado por la aplicación", () => {
    expect(proveedorTools.map((tool) => tool.name)).toEqual([
      "proveedor_leer_solicitud",
      "proveedor_mapear_campos",
      "proveedor_generar_formulario",
      "proveedor_armar_paquete",
      "proveedor_simular_envio",
    ]);
    expect(executeTool).toBeTypeOf("function");
  });
});
