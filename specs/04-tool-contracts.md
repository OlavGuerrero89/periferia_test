# Contratos de herramientas

## Propósito

Definir cómo se registran, validan y ejecutan las herramientas del agente. Las herramientas son la única vía para leer fixtures y escribir archivos del reto.

El modelo puede solicitar una herramienta, pero la aplicación valida y autoriza la llamada antes de ejecutarla.

## Contrato común

Cada herramienta registrada tiene un nombre estable, una descripción, un esquema Zod para sus argumentos y una función de ejecución.

~~~ts
interface ToolDefinition<TArgs, TResult> {
  name: string;
  description: string;
  args: z.ZodType<TArgs>;
  execute(
    args: TArgs,
    ctx: ToolContext
  ): Promise<ResultadoHerramienta<TResult>>;
}
~~~

Los tipos `ToolContext` y `ResultadoHerramienta<T>` están definidos en `specs/02-domain-contracts.md`.

## Reglas comunes de ejecución

- Los esquemas de argumentos deben rechazar propiedades desconocidas cuando puedan cambiar la intención de una llamada.
- La aplicación valida los argumentos antes de llamar a `execute`.
- `execute` devuelve siempre `ResultadoHerramienta<T>`; no propaga excepciones de implementación.
- Los errores usan códigos controlados y mensajes seguros.
- Las rutas se resuelven internamente a partir de `ctx.projectRoot`; el modelo no proporciona rutas absolutas.
- Las operaciones de lectura se limitan a `fixtures/reto-01/`.
- Las operaciones de escritura se limitan a `out/<caso>/`.
- Las herramientas no ejecutan comandos, scripts ni macros.
- Las respuestas que se envían al modelo incluyen únicamente los datos necesarios para el siguiente paso.
- Las herramientas no exponen secretos ni datos bancarios que la plantilla no haya solicitado.
- El adaptador LLM convierte el resultado estructurado a la representación requerida por el proveedor; las herramientas no devuelven texto libre como su contrato interno.

## Registro de herramientas

Los nombres expuestos al modelo deben ser exactamente los definidos en `specs/00-requirements.md`:

| Nombre | Función |
|---|---|
| `proveedor_leer_solicitud` | Leer y normalizar los datos autorizados de un caso. |
| `proveedor_mapear_campos` | Resolver etiquetas solicitadas contra las fuentes permitidas. |
| `proveedor_generar_formulario` | Generar el artefacto del formato soportado. |
| `proveedor_armar_paquete` | Preparar checklist, soportes disponibles y borrador de correo. |
| `proveedor_simular_envio` | Crear el archivo local de envío simulado después de una aprobación válida. |

La aplicación solo registra las herramientas implementadas. Una herramienta no registrada o deshabilitada no se ejecuta aunque el modelo la solicite.

## Contratos por herramienta

### `proveedor_leer_solicitud`

**Argumentos**

~~~ts
interface LeerSolicitudArgs {
  casoId: string;
}
~~~

El esquema Zod debe validar que `casoId` sea un identificador simple, no una ruta.

**Resultado exitoso**

~~~ts
type LeerSolicitudResult = {
  caso: CasoNormalizado;
  soportes: ResultadoSoporte[];
};
~~~

La herramienta:

- Lee únicamente el caso bajo `fixtures/reto-01/casos/<casoId>/`.
- Valida los JSON y la estructura necesaria antes de normalizarlos.
- Devuelve errores controlados para caso inexistente, fixture inválida o plantilla inválida.
- No modifica ningún archivo de origen.
- No devuelve al modelo campos bancarios que la plantilla no solicite.

### `proveedor_mapear_campos`

**Argumentos**

~~~ts
interface MapearCamposArgs {
  casoId: string;
}
~~~

**Resultado exitoso**

~~~ts
type MapearCamposResult = {
  casoId: string;
  campos: Array<{
    campo: CampoSolicitado;
    resolucion: ResolucionCampo;
  }>;
};
~~~

La herramienta:

- Usa únicamente la solicitud, plantilla, maestro y glosario autorizados del caso.
- Aplica las reglas de `specs/05-validation-rules.md`.
- Conserva la etiqueta original y la referencia de origen.
- No usa conocimiento general del modelo para completar campos.
- Devuelve `faltante` o `requiere_confirmacion` cuando no puede justificar un valor.

### `proveedor_generar_formulario`

**Argumentos**

~~~ts
interface GenerarFormularioArgs {
  casoId: string;
}
~~~

**Resultado exitoso**

~~~ts
type GenerarFormularioResult = {
  casoId: string;
  artefactos: ArtefactoGenerado[];
  pendientes: string[];
};
~~~

La herramienta:

- Genera únicamente el formato correspondiente al caso y permitido por las reglas.
- Usa las ubicaciones declaradas en la plantilla.
- No marca como confirmado un valor que requiere revisión.
- Escribe en `out/<casoId>/`.
- Devuelve error controlado si no puede generar o verificar el archivo.
- No sobrescribe fixtures.

### `proveedor_armar_paquete`

**Argumentos**

~~~ts
interface ArmarPaqueteArgs {
  casoId: string;
}
~~~

**Resultado exitoso**

~~~ts
type ArmarPaqueteResult = {
  casoId: string;
  estado: EstadoPaquete;
  artefactos: ArtefactoGenerado[];
};
~~~

La herramienta:

- Incluye los formularios generados, checklist, soportes disponibles y borrador de correo que correspondan.
- Refleja los estados `presente`, `ausente` y `vencido` de los soportes.
- Incluye campos faltantes y pendientes de confirmación.
- No incluye datos bancarios en el borrador de correo.
- No declara `listoParaFirma` si falta un soporte exigido, está vencido o no se generó un formulario requerido.
- No firma ni envía documentos.

### `proveedor_simular_envio`

**Argumentos**

~~~ts
interface SimularEnvioArgs {
  casoId: string;
}
~~~

**Resultado exitoso**

~~~ts
type SimularEnvioResult = {
  casoId: string;
  artefacto: ArtefactoGenerado;
  resultadoEjecucion: "completada";
};
~~~

Reglas especiales:

- La autorización se verifica en la capa de aplicación según `specs/06-human-approval.md`.
- El modelo no puede incluir una aprobación dentro de los argumentos ni concederse permisos.
- La herramienta solo puede ejecutarse con aprobación `aprobado` para `simular_envio` y el mismo `casoId`.
- El intento consume esa aprobación, incluso si la escritura falla.
- El único archivo creado es `out/<casoId>/ENVIO-SIMULADO.md`.
- Si el archivo ya existe, devuelve `archivo_ya_existe`; no lo sobrescribe ni crea duplicados.
- No envía correos, no firma documentos y no carga archivos en portales.

## Contexto y dependencias

Todas las herramientas reciben `ToolContext` con la raíz del proyecto, el ID de sesión y la fecha de ejecución.

Las dependencias de filesystem, registro y autorización se inyectan al construir el registro de herramientas. Ninguna herramienta obtiene estas dependencias desde argumentos proporcionados por el modelo.

La herramienta `proveedor_simular_envio` debe consultar la autorización confiable de la aplicación; no basta con que el modelo la haya solicitado o con que el usuario haya confirmado otro caso o acción.

`demo.ts` puede proporcionar implementaciones locales de esas dependencias para probar el flujo sin proveedor LLM ni servicios externos.

## Registro de resultados

Cada ejecución añade un evento a `out/<casoId>/log.jsonl` con, como mínimo:

- timestamp;
- nombre de la herramienta;
- estado `ok`;
- resumen seguro del resultado.

Los registros no contienen claves, credenciales ni números completos de cuentas bancarias. No se registran trazas internas en mensajes visibles para el usuario.

## Criterios de aceptación

- Cada herramienta tiene nombre, descripción, esquema Zod y función `execute`.
- La aplicación valida argumentos antes de ejecutar la herramienta.
- Todas las herramientas devuelven el sobre `ResultadoHerramienta<T>`.
- Las herramientas no propagan excepciones sin controlar.
- Las rutas fuera de las carpetas permitidas se rechazan.
- Las fixtures permanecen sin cambios tras la ejecución.
- Las respuestas no incluyen datos bancarios que la plantilla no solicite.
- Un fallo de lectura o escritura se informa como error, no como éxito.
- `proveedor_simular_envio` no se ejecuta sin aprobación válida para el caso correcto.
- El envío simulado no produce ninguna acción externa.
- Las herramientas se pueden importar desde la aplicación y desde `demo.ts`.