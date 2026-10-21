# Flujo del agente

## Propósito

Definir cómo una solicitud del chat pasa por la API, la aplicación, el modelo y las herramientas hasta producir una respuesta. El flujo debe ser auditable y limitar al modelo a los datos que devuelven las herramientas.

## Flujo por turno

1. La API valida `sessionId` y `message`.
2. La aplicación crea o recupera la sesión y agrega el mensaje del usuario al historial.
3. La aplicación construye los mensajes para el modelo con:
   - el prompt de `agent/prompt.md`;
   - el historial necesario de la sesión;
   - las definiciones de herramientas habilitadas.
4. El adaptador LLM obtiene una respuesta del proveedor.
5. Si el modelo devuelve una respuesta sin llamadas a herramientas, la aplicación finaliza el turno y devuelve el texto.
6. Si solicita herramientas, la aplicación:
   - valida cada argumento con el esquema Zod correspondiente;
   - ejecuta la herramienta con el contexto del proyecto y la sesión;
   - registra la llamada y su resultado;
   - agrega el resultado como mensaje de herramienta al historial;
   - continúa el ciclo con el modelo.
7. El ciclo termina cuando el modelo produce una respuesta final, ocurre un error controlado o se alcanza el límite de iteraciones.
8. La API devuelve la respuesta, las llamadas a herramientas y el estado de confirmación.

## Límite de iteraciones

- El máximo por turno es configurable; valor inicial recomendado: `25`.
- Una iteración se cuenta cada vez que se consulta al modelo.
- Al alcanzar el límite, no se ejecutan más herramientas en ese turno.
- El agente resume lo que alcanzó a hacer e indica qué quedó pendiente.
- El límite no se reinicia mediante una llamada recursiva a otra función.

## Mensajes y llamadas a herramientas

El backend conserva el historial necesario para continuar la conversación. Cada llamada a herramienta visible incluye:

- nombre de la herramienta;
- argumentos validados, con datos sensibles omitidos cuando no sean necesarios;
- resultado resumido;
- estado de éxito o error.

El resultado completo de una herramienta queda disponible al ciclo del agente. La interfaz puede mostrar una versión resumida que no revele información innecesaria.

## Uso de datos

- Las herramientas son la única fuente de valores del caso.
- El modelo puede resumir y explicar resultados, pero no completar valores usando conocimiento general.
- Si una herramienta devuelve un error, el agente lo comunica con lenguaje claro y puede continuar si existe una acción segura que no dependa de ese resultado.
- La aplicación no permite que el modelo lea rutas arbitrarias ni ejecute comandos.

## Estado de sesión

La sesión mantiene:

- `id`;
- historial de mensajes;
- llamadas a herramientas;
- estado de confirmación pendiente, si aplica;
- fecha de creación y última actividad, si se requiere para el manejo local.

El almacenamiento inicial puede ser en memoria. El README debe documentar que reiniciar el proceso elimina las sesiones. Las sesiones no deben incluir claves API ni secretos.

## Confirmación dentro del flujo

Cuando el agente termina de preparar el paquete y propone la simulación de envío:

1. Responde con un resumen del paquete y lo que falta.
2. Si corresponde, explica que puede generar el archivo de envío simulado.
3. Cierra el turno con una pregunta explícita de confirmación.
4. La aplicación guarda la acción y el caso pendientes.
5. Solo el mensaje inmediatamente siguiente del usuario puede confirmar esa acción.
6. Si la confirmación es válida, la aplicación permite llamar a `proveedor_simular_envio`.
7. La herramienta crea únicamente `out/<caso>/ENVIO-SIMULADO.md`.

La firma, el envío real y la carga a portales no están disponibles como herramientas.

## Contrato del adaptador LLM

La capa de aplicación depende de una interfaz propia, independiente del SDK:

~~~ts
interface LlmAdapter {
  enviar(
    mensajes: Mensaje[],
    herramientas: HerramientaDisponible[]
  ): Promise<RespuestaLlm>;
}