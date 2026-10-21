# Contratos de herramientas

## Propósito

Definir el contrato común y las entradas/salidas de las herramientas del agente. Las herramientas concentran el acceso a fixtures y la escritura en `out/`. Son importables desde el servidor y desde `demo.ts`.

## Contrato común

Cada herramienta exportada tiene:

~~~ts
interface ToolDefinition<TArgs, TResult> {
  description: string;
  args: ZodRawShape;
  execute(
    args: TArgs,
    ctx: ToolContext
  ): Promise<string>;
}