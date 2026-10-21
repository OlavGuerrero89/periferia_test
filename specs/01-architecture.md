# Arquitectura

## Decisión

Usar un **monolito modular en Next.js**. La interfaz y la API viven en la misma aplicación; la lógica del agente y las reglas de negocio se mantienen en módulos separados. No se agrega otro servidor ni una base de datos: el PRD permite sesiones en memoria o archivos y los fixtures son locales.

## Componentes y responsabilidades

| Capa | Ubicación prevista | Responsabilidad | No debe hacer |
|---|---|---|---|
| Interfaz | `src/app/`, `src/components/` | Mostrar conversación, estado de espera, llamadas a herramientas y solicitudes de confirmación. | Acceder a fixtures, llamar al proveedor LLM directamente o contener secretos. |
| API | `src/app/api/` | Validar solicitudes HTTP, invocar la aplicación y devolver respuestas seguras. | Implementar reglas de negocio o procesar archivos directamente. |
| Aplicación | `src/application/` | Coordinar el ciclo del agente, sesiones, llamadas a herramientas y límites por turno. | Leer o escribir archivos sin pasar por las herramientas/adaptadores correspondientes. |
| Dominio | `src/domain/` | Definir tipos, esquemas y reglas puras de normalización, mapeo y estado del paquete. | Depender de Next.js, del proveedor LLM o del sistema de archivos. |
| Herramientas | `src/tools/` | Implementar operaciones del reto: leer solicitudes, mapear campos, generar formularios, armar paquetes y simular envío. | Firmar, enviar información real o ejecutar comandos de shell. |
| Infraestructura | `src/infrastructure/`, `src/llm/` | Adaptar archivos, logs y proveedor LLM a interfaces usadas por la aplicación. | Introducir reglas de negocio propias. |
| Prompt y conocimiento | `agent/prompt.md`, `src/knowledge/` | Separar instrucciones de comportamiento y conocimiento del proceso. | Ser la fuente de valores de los casos; esos datos solo vienen de las herramientas. |

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
│   ├── process-request.ts
│   ├── agent-loop.ts
│   └── sessions.ts
├── components/
├── domain/
│   ├── rules/
│   └── schemas/
├── infrastructure/
│   ├── filesystem/
│   └── logging/
├── knowledge/
└── tools/
    └── proveedor.ts
demo.ts
fixtures/reto-01/
out/