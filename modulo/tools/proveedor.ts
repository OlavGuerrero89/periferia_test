/**
 * Punto de entrada reutilizable para plataformas de agentes.
 * La implementación compartida vive en src/tools y no depende de Next.js.
 */
export {
  armar_paquete,
  executeTool,
  generar_formulario,
  leer_solicitud,
  mapear_campos,
  parseToolArgs,
  proveedorTools,
  simular_envio,
} from "../../src/tools/proveedor";
export type { ProviderTool } from "../../src/tools/proveedor";
