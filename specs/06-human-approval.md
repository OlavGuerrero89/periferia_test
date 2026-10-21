# Confirmación y aprobación humana

## Propósito

Definir cuándo el agente necesita aprobación humana, cómo se interpreta esa aprobación y qué acción puede realizar después.

El agente puede preparar información y archivos locales para revisión. Solo puede crear el archivo `ENVIO-SIMULADO.md` después de recibir una confirmación explícita, inmediata y asociada al caso correcto.

La aprobación autoriza únicamente esa acción simulada. No equivale a enviar documentos, firmarlos ni cargarlos en un portal.

## Alcance

La aprobación de esta especificación aplica exclusivamente a:

- Acción: crear el archivo local `ENVIO-SIMULADO.md`.
- Ubicación: `out/<caso>/ENVIO-SIMULADO.md`.
- Caso: el identificador del caso que el agente incluye en la pregunta de confirmación.

Cualquier otra acción queda fuera de esta aprobación.

## Acciones permitidas y no permitidas

| Acción | Comportamiento |
|---|---|
| Leer solicitud, plantilla, maestro y soportes | Permitido mediante las herramientas disponibles para el reto. |
| Mapear campos y generar documentos locales | Permitido según las reglas de validación del sistema. |
| Armar el paquete para revisión | Permitido; no significa que esté aprobado, firmado o enviado. |
| Crear `out/<caso>/ENVIO-SIMULADO.md` | Permitido únicamente después de la aprobación definida en este documento. |
| Enviar correos o documentos a un cliente | No implementado. |
| Firmar documentos | No implementado. |
| Ingresar a un portal o cargar archivos | No implementado. |

## Estados de aprobación

Cada solicitud de aprobación debe tener uno de estos estados:

- `sin_confirmacion`: no existe una aprobación pendiente.
- `esperando_confirmacion`: el agente preguntó si puede crear el envío simulado para un caso específico.
- `aprobado`: el usuario confirmó la acción y el caso en el turno inmediatamente siguiente a la pregunta.
- `rechazado`: el usuario negó la acción en el turno inmediatamente siguiente.
- `expirado`: la respuesta no llegó en el turno inmediatamente siguiente, fue ambigua o no correspondió a la acción y al caso consultados.

El resultado de ejecutar la acción se registra por separado del estado de aprobación:

- `no_ejecutada`
- `completada`
- `fallida`

La aprobación no significa que la creación del archivo haya tenido éxito. El resultado solo puede ser `completada` después de verificar que el archivo se creó correctamente.

## Datos asociados a una solicitud

Cada solicitud pendiente debe estar asociada, como mínimo, con:

- `accion`: siempre `simular_envio`.
- `caso`: identificador del caso para el cual se solicita aprobación.
- `estado`: inicialmente `esperando_confirmacion`.
- `creadaEnTurno`: turno en el que el agente preguntó.
- `resultadoEjecucion`: inicialmente `no_ejecutada`.

La implementación puede usar otros nombres o estructuras, siempre que conserve estas asociaciones y reglas.

## Solicitud de aprobación

Antes de solicitar aprobación, el agente debe haber preparado el paquete para revisión y contar con un identificador de caso inequívoco.

La pregunta debe identificar la acción simulada y el caso. Debe comunicar que no se enviará nada a terceros. Por ejemplo:

> ¿Confirmas que cree `out/<caso>/ENVIO-SIMULADO.md` para el caso `<caso>`? Esto solo creará un archivo local; no enviará documentos, no los firmará ni los cargará en un portal. Responde sí o no.

Al realizar esta pregunta, el estado cambia a `esperando_confirmacion`.

## Reglas para interpretar la respuesta

La confirmación solo es válida cuando se cumplen todas estas condiciones:

1. Existe una solicitud con estado `esperando_confirmacion`.
2. La respuesta del usuario es el turno inmediatamente siguiente a la pregunta.
3. La respuesta expresa una aprobación inequívoca.
4. La aprobación corresponde a la acción `simular_envio` y al mismo caso indicado en la pregunta.

Una respuesta afirmativa inequívoca, como “sí, confirma”, cambia el estado a `aprobado`.

Una respuesta negativa inequívoca, como “no”, “cancela” o “no lo crees”, cambia el estado a `rechazado`.

Una respuesta ambigua, una respuesta sobre otro caso o una respuesta que no aprueba ni rechaza la acción cambia el estado a `expirado`. El agente no debe ejecutar la acción. Si aún se requiere aprobación, debe presentar una nueva pregunta explícita.

Si llega otro turno antes de responder a la pregunta, la solicitud pendiente cambia a `expirado`. No se puede aprobar posteriormente una solicitud vencida.

Una aprobación nunca se puede reutilizar para otro caso ni para otra acción.

## Ejecución de la acción

Cuando el estado cambie a `aprobado`, el agente puede intentar crear únicamente:

`out/<caso>/ENVIO-SIMULADO.md`

Después del intento:

- Si el archivo se creó y se verificó correctamente, el resultado cambia a `completada`.
- Si no se pudo crear o verificar, el resultado cambia a `fallida`; el agente debe informar el error sin afirmar que el archivo existe.
- Si el archivo ya existe, el agente no debe sobrescribirlo silenciosamente ni crear una copia duplicada. Debe informar que ya existe y solicitar una decisión explícita sobre cómo proceder.

Una solicitud aprobada se consume después de ese intento. Repetir la misma respuesta o procesar de nuevo el mismo turno no debe crear una segunda copia del archivo.

## Rechazo o vencimiento

Si la solicitud queda `rechazada` o `expirada`:

- No se crea `ENVIO-SIMULADO.md`.
- No se interpreta el rechazo o vencimiento como autorización implícita.
- El agente informa que no realizó la acción.
- Para volver a intentarlo, el agente debe hacer una nueva pregunta y obtener una nueva aprobación válida.

## Auditoría

La aplicación debe conservar evidencia suficiente para reconstruir la decisión y el resultado, incluyendo:

- Identificador del caso.
- Acción solicitada.
- Estado final de aprobación.
- Turno en que se preguntó y, si aplica, turno en que se respondió.
- Resultado de la ejecución.
- Ruta del archivo creado, si corresponde.
- Error técnico, si la ejecución falla.

El registro no debe incluir datos personales o contenido sensible de los soportes salvo que sea indispensable para la auditoría. La auditoría no debe afirmar que hubo envío, firma o carga externa.

## Criterios de aceptación

1. Si no existe una solicitud pendiente, una respuesta afirmativa no crea `ENVIO-SIMULADO.md`.
2. Después de preguntar por un caso específico, una aprobación explícita en el turno inmediatamente siguiente permite intentar crear únicamente el archivo local de ese caso.
3. Una respuesta afirmativa recibida después de otro turno no autoriza la acción.
4. Una respuesta ambigua no autoriza la acción y deja la solicitud expirada.
5. Una aprobación para un caso no autoriza la creación del archivo para otro caso.
6. Un rechazo deja la solicitud rechazada y no crea el archivo.
7. Una solicitud rechazada o expirada no puede ejecutarse sin una nueva aprobación.
8. Si la creación del archivo falla, el resultado queda como `fallida` y el agente informa que no se completó.
9. Si el archivo ya existe, el agente no lo sobrescribe ni crea duplicados sin una decisión explícita.
10. Procesar dos veces la misma aprobación no produce más de un archivo.
11. La creación del archivo no envía correo, no firma documentos y no carga archivos en un portal.
12. La auditoría permite identificar el caso, la decisión y el resultado sin registrar datos sensibles innecesarios.