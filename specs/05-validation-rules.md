# Reglas de validación y negocio

## Propósito

Establecer cómo se validan las solicitudes, los campos, los soportes y los archivos generados. Las reglas deben ser deterministas y probarse sin depender de un modelo LLM.

## Validación de entrada

### Nombre del caso

- Debe ser un nombre simple de carpeta.
- No puede ser vacío, contener `..`, separadores de ruta ni una ruta absoluta.
- Debe existir bajo `fixtures/reto-01/casos/`.
- No se permite leer archivos fuera de las carpetas del reto.

### Archivos JSON

- Se valida la estructura mínima requerida antes de usar los datos.
- Un JSON inválido produce un error `fixture_invalido`.
- No se corrige silenciosamente un valor inválido ni se completa con datos inferidos.
- Los archivos de fixtures se consideran de solo lectura.

### Plantillas

- Excel requiere nombre de hoja, etiqueta, celda de etiqueta y celda de valor.
- PDF requiere etiqueta y conserva el orden de los campos.
- Campos duplicados se reportan o se rechazan claramente; no se escriben dos valores en una misma ubicación sin regla explícita.
- Formato ausente o no reconocido produce error controlado o se trata como no soportado según el flujo del caso.

## Validación y mapeo de campos

### Estados

Cada campo solicitado tiene exactamente uno de estos estados:

- `lleno`: se encontró una fuente autorizada y se registró su ruta.
- `faltante`: no se encontró un valor en el maestro; no se asigna valor.
- `requiere_confirmacion`: el dato o su interpretación necesitan revisión humana.

### Glosario y confianza

- Las etiquetas presentes en `glosario-campos.json` se resuelven de forma determinista.
- Los sinónimos desconocidos no se aproximan mediante conocimiento libre del modelo.
- Si el mapeo tiene confianza menor que `0.8`, se marca `requiere_confirmacion`.
- Un campo ambiguo también requiere confirmación aunque exista un valor parecido en el maestro.
- El resultado conserva la etiqueta original y la clave del maestro propuesta, si existe.

### Identificador tributario

| País | Identificador solicitado |
|---|---|
| CO | NIT |
| EC | RUC |
| PE | RUC |
| PA | RUC |
| HN | RTN |

Periferia solo tiene el NIT colombiano. Si el caso pertenece a EC, PE, PA o HN y solo se dispone del NIT colombiano, el campo puede mostrarlo como propuesta, pero debe quedar en `requiere_confirmacion` con la nota exacta `identificador extranjero`. No presentarlo como un RUC o RTN válido.

### Datos bancarios

- Solo se leen y se incluyen si una plantilla solicita explícitamente el campo bancario.
- No se incorporan al borrador de correo.
- Los logs no registran el número completo de una cuenta.
- Si el campo no está solicitado, la herramienta no devuelve ese dato al modelo.

## Validación de soportes y vigencia

Cada soporte exigido queda como `presente`, `ausente` o `vencido`.

- `presente`: el archivo requerido existe y no está vencido.
- `ausente`: el índice o archivo requerido no está disponible.
- `vencido`: `vigencia_hasta` es anterior a la fecha de ejecución.
- Si `vigencia_hasta` coincide con la fecha de ejecución, se considera vigente durante ese día.
- Si el soporte no tiene fecha de vigencia, se considera vigente solo si existe el archivo; no se inventa una fecha.
- La comparación usa fechas calendario `YYYY-MM-DD`.
- La fecha de ejecución se inyecta para pruebas; en ejecución normal se deriva usando `America/Bogota`.

Un soporte exigido ausente o vencido bloquea `listo_para_firma`. Un campo faltante o que requiere confirmación se reporta, pero por sí solo no bloquea ese estado.

## Reglas de generación de archivos

### Excel

- Escribir solo en hojas y celdas definidas por la plantilla.
- No alterar las celdas de etiqueta.
- No crear valores para campos `faltante`.
- Para `requiere_confirmacion`, seguir la decisión acordada para la demo: no escribir un valor como confirmado; marcarlo claramente o dejar la celda sin completar.
- Guardar en `out/<caso>/formulario.xlsx`.

### PDF

- Generar un PDF con etiqueta y valor por campo, en el orden de la plantilla.
- Los campos `faltante` se muestran como pendientes; no se rellenan con valores supuestos.
- Los campos `requiere_confirmacion` se identifican como pendientes de revisión.
- Guardar en `out/<caso>/formulario.pdf`.

### Portal

- No automatizar login, navegación ni envío.
- Generar un Markdown con valores copiables y sus estados.
- Guardar en `out/<caso>/valores-portal.md`.
- Informar que el formato no está automatizado.

### Paquete

- El paquete refleja los archivos disponibles y el resultado de las validaciones.
- Incluye checklist, soportes disponibles, formulario y borrador de correo.
- No incluir credenciales, claves ni datos bancarios en el borrador.
- `listo_para_firma` es falso si falta o está vencido algún soporte exigido.
- No marcar como listo para firma si el formulario no pudo generarse.

## Validación de confirmación

- La confirmación debe referirse a la acción y al caso pendientes.
- Debe llegar en el siguiente mensaje del usuario después de la pregunta explícita.
- Se invalida si el usuario cambia de tema, solicita otra acción o se procesa otro turno sin confirmar.
- Una confirmación válida solo permite escribir `ENVIO-SIMULADO.md`.
- No se realiza ninguna acción externa real.

## Seguridad de archivos

- Resolver rutas con APIs de rutas del sistema operativo, usando `ctx.directory` como raíz.
- Verificar que la ruta resuelta continúe dentro de la carpeta permitida.
- No aceptar nombres de archivo proporcionados libremente por el modelo.
- Escribir exclusivamente dentro de `out/`.
- No ejecutar comandos, scripts, macros ni contenido de archivos.

## Criterios de aceptación

- Un valor sin ruta fuente nunca queda como `lleno`.
- Un valor inexistente no se sustituye por una conjetura.
- La nota de identificador extranjero coincide exactamente con el texto requerido.
- Datos bancarios no aparecen si no los pide la plantilla y nunca aparecen en el borrador de correo.
- Soportes vencidos y ausentes bloquean el estado de firma.
- Campos faltantes no bloquean por sí solos el estado de firma.
- Un nombre de caso malicioso no permite leer ni escribir fuera de las rutas aprobadas.
- La generación no modifica fixtures.