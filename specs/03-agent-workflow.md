# Flujo del agente

## Propósito

Definir cómo una solicitud pasa por la API, la aplicación, el modelo y las herramientas hasta producir una respuesta.

La aplicación controla el flujo y las autorizaciones. El modelo interpreta la solicitud y puede proponer llamadas a herramientas, pero no accede directamente al filesystem, no decide si una aprobación es válida y no reemplaza las reglas del dominio.

## Responsabilidades

- **API:** valida la entrada y entrega una respuesta con estructura estable.
- **Aplicación:** coordina sesión, aprobación, ciclo del agente y ejecución de herramientas.
- **Dominio:** valida datos y aplica reglas deterministas.
- **Adaptador LLM:** traduce mensajes y herramientas entre la aplicación y el proveedor.
- **Herramientas:** realizan operaciones autorizadas sobre fixtures y `out/`.
- **Interfaz:** muestra mensajes, resultados y solicitudes de confirmación sin ejecutar acciones de negocio.

## Flujo de una solicitud

1. La API valida `sessionId` y `message`.
2. La aplicación crea o recupera la sesión y agrega el mensaje del usuario al historial.
3. Si hay una aprobación pendiente, la aplicación la resuelve antes de ejecutar nuevas herramientas:
   - una respuesta válida en el turno inmediatamente siguiente puede aprobar o rechazar la acción pendiente;
   - una respuesta ambigua, sobre otro caso o que no corresponda a la acción hace expirar la solicitud;
   - una solicitud expirada no autoriza la ejecución.
4. La aplicación construye el contexto para el modelo con:
   - el cuerpo de `modulo/agent.md` después de retirar su frontmatter;
   - el conocimiento de `modulo/skill/registro-proveedor/SKILL.md` después de retirar su frontmatter;
   - el historial necesario de la sesión;
   - las definiciones de herramientas disponibles.
5. El adaptador LLM consulta al proveedor. Si la consulta falla antes de ejecutar herramientas y el mensaje contiene un ID de caso explícito, la aplicación usa sin modelo las herramientas compartidas para leer, mapear, generar el formulario y preparar el paquete. Si el caso no es explícito, o ya hubo llamadas de herramientas en el turno, devuelve una respuesta de respaldo sin repetirlas. El respaldo no ejecuta `proveedor_simular_envio`; si preparó el paquete, conserva la solicitud de confirmación humana para el turno siguiente.
6. Si el modelo responde sin solicitar herramientas, la aplicación finaliza el turno.
7. Si el modelo solicita herramientas, la aplicación:
   - verifica que cada herramienta esté registrada y habilitada;
   - valida los argumentos con el esquema Zod correspondiente;
   - aplica las reglas de autorización antes de despachar la herramienta;
   - ejecuta la herramienta con el contexto autorizado;
   - registra el resultado;
   - agrega el resultado estructurado al historial del ciclo.
8. La aplicación vuelve a consultar al modelo con los resultados de las herramientas.
9. El ciclo termina cuando el modelo produce una respuesta final, ocurre un error controlado o se alcanza el límite de iteraciones.
10. La API devuelve la respuesta final, las llamadas a herramientas que se pueden mostrar y el estado de la sesión y de aprobación.

## Orden del flujo del caso

Para procesar un caso, el agente debe seguir este orden lógico:

1. Leer solicitud, plantilla, maestro y soportes mediante `proveedor_leer_solicitud`.
2. Resolver los campos solicitados mediante `proveedor_mapear_campos`.
3. Explicar campos `faltante` o `requiere_confirmacion` y revisar el estado de los soportes.
4. Generar los formularios soportados mediante `proveedor_generar_formulario`.
5. Preparar el paquete de revisión mediante `proveedor_armar_paquete`.
6. Presentar un resumen fiel del resultado, sus pendientes y bloqueos.
7. Si corresponde, solicitar aprobación para crear el envío simulado.
8. Solo después de una aprobación válida para el mismo caso, permitir `proveedor_simular_envio`.

El flujo puede omitir una herramienta cuando su acción no aplique al formato o al estado del caso. No puede omitir una validación requerida ni afirmar que un archivo fue generado si la herramienta no lo verificó.

## Uso de datos y respuestas

- Las herramientas son la fuente de los valores específicos del caso.
- El modelo puede resumir y explicar resultados, pero no completar campos con conocimiento general.
- Los valores de una respuesta deben estar respaldados por resultados de herramientas.
- Si un valor es `faltante`, el agente lo presenta como pendiente.
- Si un valor es `requiere_confirmacion`, el agente presenta la propuesta como no confirmada e indica el motivo disponible.
- Los errores de herramientas se comunican con lenguaje claro. El agente puede continuar únicamente con acciones seguras que no dependan del resultado fallido.
- El agente no afirma que un formulario, paquete o envío simulado existe hasta recibir una operación exitosa y verificada.

## Autorización de herramientas

El modelo no puede concederse permisos a sí mismo ni incluir una aprobación válida en los argumentos de una llamada.

Antes de ejecutar una herramienta, la capa de aplicación verifica que:

- la herramienta pertenezca al registro permitido;
- los argumentos cumplan su esquema;
- el caso y las rutas pertenezcan al alcance autorizado;
- la acción no requiera una aprobación pendiente o vencida.

La herramienta `proveedor_simular_envio` se bloquea salvo que la capa de aplicación confirme una aprobación `aprobado` para la acción `simular_envio` y el mismo `casoId`.

La única acción autorizada por esa aprobación es crear `out/<caso>/ENVIO-SIMULADO.md`. No habilita firma, correo real ni carga en portales.

## Solicitud y ciclo de aprobación

Cuando el paquete esté preparado y se pueda ofrecer la simulación:

1. El agente resume los archivos generados, pendientes y bloqueos relevantes.
2. El agente pregunta explícitamente si puede crear `out/<caso>/ENVIO-SIMULADO.md`.
3. La aplicación conserva la acción y el caso asociados a la solicitud pendiente.
4. La respuesta del usuario se evalúa conforme a `specs/06-human-approval.md`.
5. Si queda `aprobado`, la aplicación habilita la herramienta para ese caso y consume la aprobación tras el intento.
6. Si queda `rechazado` o `expirado`, no se ejecuta la herramienta.

La aplicación no considera como confirmación un texto generado por el modelo, una respuesta de herramienta ni una aprobación de otro turno o caso.

## Límite de iteraciones y tiempo

- El máximo inicial recomendado es de `25` consultas al modelo por turno.
- El límite puede configurarse mediante configuración del servidor.
- Cada consulta al modelo cuenta como una iteración.
- Al alcanzar el límite, no se ejecutan más herramientas en ese turno.
- El agente devuelve un resumen de lo completado y de lo pendiente.
- El ciclo no puede reiniciar el contador mediante llamadas recursivas.
- El adaptador LLM debe tener un timeout configurable.
- Un timeout o error del proveedor produce un error controlado y no se presenta como éxito.

## Historial y estado de sesión

La sesión mantiene, como mínimo:

- `id`;
- mensajes necesarios para continuar la conversación;
- llamadas a herramientas y sus estados;
- estado de aprobación pendiente, si existe;
- fecha de creación y última actividad, si se usan para administrar la sesión.

El almacenamiento inicial puede ser en memoria. Reiniciar el proceso puede eliminar las sesiones; esta limitación se documenta en `README.md`.

La sesión no almacena claves API, credenciales ni datos sensibles que no se necesiten para continuar el flujo.

## Registro de actividad

Cada ejecución de herramienta añade un evento a `out/<caso>/log.jsonl` con, como mínimo:

- timestamp;
- nombre de la herramienta;
- estado de éxito o error;
- resumen seguro del resultado.

Los registros no contienen claves, credenciales ni números completos de cuentas bancarias. Los errores no incluyen trazas internas en resultados visibles para el usuario.

## Errores controlados

- Argumentos inválidos: la herramienta no se ejecuta y la aplicación registra un error controlado.
- Herramienta no registrada o deshabilitada: no se ejecuta.
- Error de lectura o escritura: se comunica el fallo sin afirmar que el artefacto existe.
- Error o timeout del proveedor LLM: el turno continúa con el flujo determinista solo cuando se puede identificar el caso y no se ejecutaron herramientas previamente; de lo contrario finaliza con instrucciones de respaldo. La sesión se conserva y no se afirma que una acción fallida se completó.
- Límite de iteraciones: el ciclo se detiene y resume los resultados ya obtenidos.
- Error de aprobación: la simulación de envío no se ejecuta.

## Criterios de aceptación

- El modelo no accede directamente a fixtures, `out/`, variables de entorno ni comandos.
- Las herramientas solicitadas por el modelo se validan antes de ejecutarse.
- Los resultados de herramientas se conservan como resultados estructurados en el ciclo.
- Un valor del caso no aparece en la respuesta si no proviene de una fuente autorizada.
- Una solicitud de confirmación queda asociada a una acción y un caso.
- Una aprobación solo puede habilitar la simulación del mismo caso y en el turno permitido.
- Una respuesta ambigua, rechazada o expirada no ejecuta `proveedor_simular_envio`.
- El ciclo se detiene al alcanzar el límite de iteraciones.
- Los errores del modelo y de herramientas no terminan la sesión con una excepción sin controlar.
- La ausencia de clave y los errores de autenticación, límite/cuota, timeout o indisponibilidad producen `mode: "fallback"` sin exponer secretos; un caso explícito puede procesarse con herramientas deterministas y la confirmación humana sigue vigente.
- El agente no presenta como completada una operación que falló.
- No se ejecuta firma, envío real ni carga a portales.
