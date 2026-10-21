# Reglas de validación y negocio

## Propósito

Definir reglas deterministas para validar solicitudes, mapear campos, revisar soportes y generar archivos. Las reglas de dominio deben poder probarse sin depender de un modelo LLM.

## Principios

- Los datos del caso provienen de los archivos y herramientas autorizados para ese caso.
- El sistema no inventa, completa ni corrige silenciosamente valores.
- Cada valor completado debe conservar la fuente de la que se obtuvo.
- Las validaciones deben producir resultados claros y comprobables.
- Las fixtures del reto son de solo lectura.
- Los archivos generados se escriben únicamente dentro de `out/`.

## Validación de entrada

### Identificador del caso

- El identificador debe ser un nombre simple de carpeta.
- No puede estar vacío, contener `..`, separadores de ruta ni representar una ruta absoluta.
- El caso debe existir bajo `fixtures/reto-01/casos/`.
- La lectura de archivos debe permanecer dentro de la carpeta autorizada para ese caso.
- Si el caso no existe o el identificador no es válido, la operación devuelve un error controlado.

### Archivos JSON

- Antes de usar un JSON se valida que se pueda leer y que incluya los campos requeridos por el flujo.
- Un JSON mal formado produce el error `fixture_invalido`.
- Un campo requerido ausente se reporta; no se completa con una suposición.
- Los archivos de fixtures no se modifican durante la ejecución.

### Plantillas

- Cada campo de una plantilla debe indicar la información necesaria para ubicarlo y escribirlo.
- En Excel se requiere, como mínimo, hoja, etiqueta, celda de etiqueta y celda de valor.
- En PDF se requiere etiqueta y orden del campo.
- Las etiquetas duplicadas o las ubicaciones incompatibles se reportan como error o pendiente de revisión; el sistema no decide silenciosamente dónde escribir.
- Un formato no reconocido se identifica como no soportado y no se procesa como si fuera válido.

## Validación y mapeo de campos

Cada campo solicitado tiene exactamente uno de estos estados:

- `lleno`: se encontró un valor en una fuente autorizada y se registró su procedencia.
- `faltante`: no se encontró un valor en una fuente autorizada.
- `requiere_confirmacion`: el valor encontrado o su interpretación necesitan revisión humana.

Reglas:

- Un campo `lleno` debe incluir el valor, la fuente y la ruta o referencia que permite localizarlo.
- Un campo `faltante` no recibe un valor por defecto ni uno inferido.
- Un campo `requiere_confirmacion` conserva la etiqueta original y el valor o mapeo propuesto, si existe.
- Las etiquetas incluidas en `glosario-campos.json` se resuelven según ese glosario.
- Los sinónimos desconocidos no se resuelven mediante conocimiento general del modelo.
- Si la confianza del mapeo es menor que `0.8`, el campo queda en `requiere_confirmacion`.
- Si la confianza es exactamente `0.8` o superior, el sistema puede aplicar el mapeo documentado y conservar la evidencia.
- Aunque la confianza sea alta, un conflicto entre fuentes o una ambigüedad relevante requiere confirmación.

## Identificador tributario

El identificador solicitado depende del país:

| País | Identificador |
|---|---|
| CO | NIT |
| EC | RUC |
| PE | RUC |
| PA | RUC |
| HN | RTN |

Periferia dispone del NIT colombiano. Si un caso de EC, PE, PA o HN no cuenta con el identificador local y solo existe el NIT colombiano:

- El NIT puede mostrarse como propuesta únicamente si el flujo requiere presentar el dato disponible.
- El campo queda en `requiere_confirmacion`.
- Se incluye exactamente la nota `identificador extranjero`.
- El sistema no presenta el NIT como un RUC o RTN válido ni lo convierte a otro identificador.

## Datos bancarios

- Solo se leen y usan si una plantilla solicita explícitamente el dato bancario correspondiente.
- Si la plantilla no los solicita, la herramienta no devuelve esos datos al modelo.
- Los datos bancarios no se incluyen en el borrador de correo.
- Los logs no registran números completos de cuenta ni credenciales.
- Si es indispensable registrar una referencia bancaria, se enmascara el valor.

## Validación de soportes y vigencia

Cada soporte exigido se clasifica como:

- `presente`: el archivo requerido existe y está vigente.
- `ausente`: el archivo o la referencia requerida no está disponible.
- `vencido`: la fecha de vigencia terminó antes de la fecha de ejecución.

Reglas de vigencia:

- Las fechas se comparan en formato calendario `YYYY-MM-DD`.
- La fecha de ejecución se inyecta en las pruebas.
- En ejecución normal se determina usando la zona horaria `America/Bogota`.
- Si `vigencia_hasta` es igual a la fecha de ejecución, el soporte se considera vigente durante ese día.
- Si el soporte no tiene fecha de vigencia, se considera vigente solo si el archivo existe; no se inventa una fecha.

Un soporte exigido ausente o vencido bloquea `listo_para_firma`. Los campos `faltante` o `requiere_confirmacion` se muestran en el checklist y no bloquean por sí solos ese estado. Esta marca no significa que el sistema haya firmado o enviado documentos.

## Generación de archivos

### Excel — prioridad P0

- Se escribe únicamente en las hojas y celdas indicadas por la plantilla.
- Las celdas con etiquetas no se modifican.
- Los campos `faltante` se dejan sin valor.
- Los campos `requiere_confirmacion` no se presentan como valores confirmados: se dejan pendientes o se marcan según el formato de la plantilla.
- El archivo se guarda en `out/<caso>/formulario.xlsx`.
- Una plantilla inválida o un error al generar el archivo se reporta; no se entrega un archivo parcial como exitoso.

### PDF — prioridad P1

- Se genera un PDF con los campos en el orden de la plantilla.
- Los campos `faltante` se identifican como pendientes.
- Los campos `requiere_confirmacion` se identifican como sujetos a revisión.
- El archivo se guarda en `out/<caso>/formulario.pdf`.
- Si el reto no permite completar un PDF de origen, se genera el artefacto definido por la solución y se documenta la limitación; no se afirma que se modificó el PDF original.

### Portal — prioridad P2

- No se automatizan autenticación, navegación, carga ni envío en un portal.
- Se genera un Markdown con los valores copiables y su estado.
- El archivo se guarda en `out/<caso>/valores-portal.md`.
- La respuesta indica que el portal no está automatizado y que la carga debe hacerla una persona.

## Paquete y estado para firma

El paquete debe reflejar los resultados reales de las validaciones e incluir, cuando estén disponibles:

- Checklist de campos y estados.
- Soportes disponibles.
- Formularios generados.
- Borrador de correo.
- Pendientes y errores detectados.

Reglas para `listo_para_firma`:

- Es `false` si falta o está vencido un soporte exigido.
- Es `false` si no se pudo generar un formulario requerido por el flujo.
- La ausencia de un campo, por sí sola, no lo vuelve `false`; el campo debe aparecer en el checklist.
- El estado no representa una firma, envío o carga real.

## Seguridad de archivos

- Todas las rutas se resuelven con APIs de rutas del sistema operativo y con `ctx.directory` como raíz.
- Antes de leer o escribir, se verifica que la ruta final permanezca dentro de la carpeta permitida.
- El modelo no proporciona rutas arbitrarias ni nombres libres de archivo para escritura.
- Las salidas se escriben exclusivamente dentro de `out/<caso>/`.
- No se ejecutan comandos, scripts, macros ni contenido leído de los archivos.
- Las fixtures del reto nunca se sobrescriben.

## Confirmación de acciones

La creación de `ENVIO-SIMULADO.md` se rige por `specs/06-human-approval.md`.

- Sin aprobación válida e inmediata para el mismo caso no se crea el archivo.
- La aprobación solo autoriza crear el archivo local `out/<caso>/ENVIO-SIMULADO.md`.
- No se realiza ningún envío, firma o carga externa.
- La creación se registra en `out/<caso>/log.jsonl`.

## Criterios de aceptación

- Un valor sin fuente identificable nunca queda en estado `lleno`.
- Un dato inexistente no se sustituye por una conjetura.
- La confianza menor a `0.8` requiere confirmación; el límite `0.8` se prueba explícitamente.
- El identificador tributario extranjero queda pendiente con la nota exacta `identificador extranjero`.
- Los datos bancarios no solicitados no se devuelven al modelo ni aparecen en el borrador de correo.
- Los soportes exigidos ausentes o vencidos bloquean `listo_para_firma`.
- Un campo faltante por sí solo no bloquea `listo_para_firma`.
- Una ruta maliciosa no permite leer fuera de las fixtures ni escribir fuera de `out/`.
- La generación no modifica fixtures.
- Una falla de generación no se reporta como una generación exitosa.
- El envío simulado no se crea sin la aprobación definida en `specs/06-human-approval.md`.