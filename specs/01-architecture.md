# Arquitectura

## Decisión

Construir la solución como un monolito modular en Next.js con TypeScript.

La interfaz y la API viven en la misma aplicación. El dominio, la coordinación del agente, las herramientas y las integraciones se mantienen en módulos separados para que sus responsabilidades puedan probarse de forma independiente.

No se agrega una base de datos para el alcance inicial. Las sesiones pueden mantenerse en memoria y los archivos del reto se leen desde `fixtures/`; los resultados se escriben en `out/`.

## Componentes y responsabilidades

| Componente | Ubicación | Responsabilidad | No debe hacer |
|---|---|---|---|
| Interfaz | `src/app/`, `src/components/` | Mostrar la conversación, estado de espera, llamadas a herramientas, resultados y confirmaciones pendientes. | Leer fixtures, aplicar reglas de negocio o llamar directamente al proveedor LLM. |
| API | `src/app/api/` | Validar solicitudes HTTP, invocar la aplicación y devolver respuestas con estructura estable. | Procesar archivos directamente o implementar reglas de negocio. |
| Aplicación | `src/application/` | Coordinar sesiones, flujo del agente, llamadas a herramientas y límites de ejecución. | Acceder al filesystem fuera de las interfaces y herramientas definidas. |
| Dominio | `src/domain/` | Contener tipos, esquemas y reglas puras de negocio, validación y estados. | Depender de Next.js, del proveedor LLM o del filesystem. |
| Herramientas | `src/tools/` | Leer datos autorizados, mapear campos, generar archivos, armar paquetes y crear el envío simulado autorizado. | Firmar, enviar información real, cargar archivos en portales o ejecutar comandos. |
| Infraestructura | `src/infrastructure/` | Adaptar filesystem, registro de eventos y proveedor LLM a interfaces usadas por la aplicación. | Definir reglas de negocio o permitir acceso arbitrario a archivos. |
| Prompt del agente | `agent/prompt.md` | Definir instrucciones de comportamiento, límites y uso de herramientas. | Ser fuente de datos de clientes o reemplazar las validaciones del dominio. |
| Conocimiento del proceso | `src/knowledge/` | Explicar el proceso, los documentos y las reglas generales del reto. | Contener valores de los casos o datos sensibles de fixtures. |
| Demo | `demo.ts` | Ejecutar las herramientas con todos los casos sin requerir modelo ni clave LLM. | Alterar fixtures o borrar datos ajenos a su directorio de salida. |

## Estructura objetivo

```text
agent/
└── prompt.md
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts
│   │   ├── health/route.ts
│   │   └── sessions/[id]/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── application/
│   ├── agent-loop.ts
│   ├── process-request.ts
│   └── sessions.ts
├── components/
├── domain/
│   ├── rules/
│   └── schemas/
├── infrastructure/
│   ├── filesystem/
│   ├── llm/
│   └── logging/
├── knowledge/
└── tools/
    └── proveedor.ts
fixtures/
└── reto-01/
out/
tests/
demo.ts
```

La estructura puede ajustarse durante la implementación si se conserva la separación de responsabilidades y se actualizan los specs relacionados.

## Flujo principal de una solicitud

1. La interfaz envía el mensaje y el identificador de sesión a la API.
2. La API valida la entrada y delega el procesamiento a la capa de aplicación.
3. La aplicación crea o recupera la sesión y prepara el contexto del agente.
4. El ciclo del agente consulta el adaptador LLM y valida las llamadas solicitadas contra los esquemas de herramientas.
5. La aplicación ejecuta las herramientas autorizadas y registra sus resultados.
6. El agente usa los resultados para responder o solicitar una aprobación humana.
7. La API devuelve la respuesta, las llamadas a herramientas que se pueden mostrar y el estado de la sesión.
8. La interfaz presenta la respuesta y los resultados de manera comprensible.

La capa de aplicación controla el ciclo. El modelo no ejecuta herramientas directamente ni accede al filesystem.

## Flujo de la demo

`demo.ts` importa las mismas herramientas que usa la aplicación y las ejecuta de forma determinista para todos los casos disponibles.

La demo no consulta un proveedor LLM y no necesita una clave API. Puede limpiar su propio directorio de salida antes de ejecutarse, siempre que no elimine fixtures ni archivos fuera de `out/`.

## Adaptador LLM

La aplicación depende de una interfaz propia para comunicarse con el modelo. La implementación concreta del proveedor vive en infraestructura.

Esto permite cambiar el SDK o proveedor sin modificar las reglas de dominio ni el flujo principal del agente. Las claves se leen únicamente desde variables de entorno del servidor.

Las pruebas automatizadas usan un adaptador falso y no requieren conexión a un proveedor.

## Sesiones

El almacenamiento inicial de sesiones puede ser en memoria. Una sesión mantiene, como mínimo:

- Identificador de sesión.
- Historial necesario de mensajes.
- Llamadas a herramientas y sus estados.
- Estado de aprobación pendiente, si existe.
- Fecha de creación y última actividad, si se necesitan para administrar la sesión.

Reiniciar el proceso puede eliminar las sesiones en memoria; esta limitación debe explicarse en `README.md`.

Las sesiones no deben contener claves API, credenciales ni datos que no sean necesarios para continuar el flujo.

## Archivos y seguridad

- Las fixtures del reto son de solo lectura.
- Las rutas de entrada se resuelven dentro de `fixtures/reto-01/`.
- Los archivos generados se escriben dentro de `out/<caso>/`.
- Las herramientas validan las rutas antes de leer o escribir.
- El modelo no puede seleccionar rutas arbitrarias ni nombres de archivo fuera de los esquemas permitidos.
- No se ejecutan comandos, scripts ni macros obtenidos de mensajes o archivos.
- Los errores internos no deben exponer secretos ni trazas en la interfaz.

## Límites funcionales

La arquitectura permite preparar formularios, checklists, paquetes y borradores para revisión humana. La firma, el envío real de correos o documentos y la carga a portales quedan fuera del alcance.

La creación de `out/<caso>/ENVIO-SIMULADO.md` requiere la confirmación definida en `specs/06-human-approval.md`.

## Criterios de aceptación

- La interfaz no tiene acceso directo a fixtures ni a claves del proveedor LLM.
- Las reglas de dominio pueden probarse sin Next.js ni servicios externos.
- La aplicación ejecuta herramientas solo mediante contratos validados.
- El proveedor LLM se puede sustituir sin reescribir el dominio ni las herramientas.
- `demo.ts` ejecuta las herramientas sin clave LLM.
- Las fixtures no se modifican y las salidas se mantienen dentro de `out/`.
- La sesión y el estado de confirmación se coordinan desde la capa de aplicación.
- No existe una herramienta para firmar, enviar información real o cargar documentos en portales.