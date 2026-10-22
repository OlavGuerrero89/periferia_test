# Registro de proveedores — Periferia

Aplicación independiente para leer solicitudes de registro, mapear campos con fuente verificable, generar formularios y preparar un paquete para revisión humana. No firma, no envía documentos y no inicia sesión ni carga archivos en portales.

## Estado de esta versión

- Chat web y API con sesión en memoria.
- Agente con herramientas tipadas y validadas con Zod, adaptador OpenAI configurable y límite de iteraciones/tokens.
- Excel P0, PDF P1 y valores copiables para portal P2.
- Checklist de soportes, borrador de correo, auditoría JSONL y confirmación inmediata para crear el envío simulado local.
- Incluye `demo-sintetica`, un caso de prueba inventado. No contiene datos de clientes ni documentos reales.
- Incluye el módulo reusable en `modulo/`: prompt, skill del proceso y herramientas importables sin iniciar el servidor Next.js.
- Los fixtures originales del reto aún deben copiarse a `fixtures/reto-01/` para validar los casos de entrega.

## Requisitos

- Node.js 20 o superior.
- Corepack y pnpm `11.25.0` (fijado en `package.json`, lockfile, Docker y CI).

## Arranque local

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Edita `.env.local` y asigna tu clave a `OPENAI_API_KEY`. La clave solo se lee desde el servidor y no se debe subir a Git. Luego:

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). El chat sugiere empezar con `Procesa el caso demo-sintetica`.

## Variables de entorno

| Variable | Uso | Valor de ejemplo |
|---|---|---|
| `OPENAI_API_KEY` | Clave del proveedor, solo en servidor. | Vacío en `.env.example` |
| `OPENAI_MODEL` | Modelo de chat y llamadas a herramientas. | `gpt-6-luna` |
| `DATA_DIR` | Ruta relativa al proyecto con `casos/`, `repositorio/` y el glosario. | `./fixtures/demo/reto-01` |
| `DATA_DIR_HOST` | Directorio de fixtures montado como solo lectura por Docker Compose. | `./fixtures/demo/reto-01` |
| `AGENT_MAX_ITERATIONS` | Máximo de rondas modelo/herramientas por turno (tope interno: 25). | `12` |
| `LLM_MAX_OUTPUT_TOKENS` | Máximo de salida por solicitud al modelo. | `1200` |
| `SESSION_TOKEN_LIMIT` | Presupuesto aproximado de tokens por sesión. Se usa el consumo reportado por el proveedor cuando está disponible. | `20000` |
| `LLM_TIMEOUT_MS` | Tiempo máximo de espera del proveedor. | `30000` |

## Verificación sin modelo

La demo no requiere `OPENAI_API_KEY`. Copia los fixtures a un directorio temporal, ejecuta las mismas herramientas, imprime el resumen por caso y elimina ese directorio temporal al finalizar; no borra `out/` ni modifica fixtures.

```bash
pnpm demo
```

## Pruebas y calidad

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm demo
pnpm build
```

## API

- `POST /api/chat` con `{ "sessionId"?: "uuid", "message": "..." }`. Devuelve `reply`, `toolCalls`, `needsConfirmation` y `sessionId`.
- `GET /api/sessions/:id` devuelve mensajes, llamadas visibles y estado de aprobación.
- `GET /api/health` devuelve proveedor, modelo y si la clave está configurada; nunca devuelve la clave.

Ejemplo local:

```bash
curl http://localhost:3000/api/health
```

## Módulo para otras plataformas de agentes

`modulo/agent.md` declara `mode: primary` y permisos `edit: deny`, `bash: deny`; la aplicación usa su cuerpo como prompt de sistema. `modulo/skill/registro-proveedor/SKILL.md` contiene el conocimiento que también carga el agente. El punto de entrada `modulo/tools/proveedor.ts` exporta las mismas herramientas que consume el chat.

Las herramientas pueden importarse desde un runtime Node.js/TypeScript sin levantar Next.js. El consumidor debe instalar las dependencias declaradas en `package.json`, proporcionar el `ToolContext` y definir sus directorios de fixtures y salida. Ejemplo:

```ts
import { proveedorTools, executeTool } from "./modulo/tools/proveedor";

const tool = proveedorTools.find((item) => item.name === "proveedor_leer_solicitud");
if (tool) {
  const result = await executeTool(tool, { casoId: "demo-sintetica" }, context);
  console.log(result);
}
```

## Artefactos

Los resultados se escriben bajo `out/<caso>/`. El paquete se ubica en `out/<caso>/paquete/`. `ENVIO-SIMULADO.md` solo se crea después de una aprobación inequívoca en el turno inmediatamente siguiente a la pregunta.

## Docker

Configura `.env` para Compose y ejecuta. Para usar los fixtures reales, cambia `DATA_DIR_HOST` a `./fixtures/reto-01`; el volumen se monta como solo lectura.

```bash
docker compose up --build
```

### Despliegue de prueba en Render

El archivo `render.yaml` define un servicio web Docker para la rama `codex/fix-specs-ci`, con fixtures sintéticos y la comprobación de salud en `/api/health`. En Render crea un Blueprint y conecta el repositorio `OlavGuerrero89/periferia_test`; Render leerá esa configuración y publicará la URL cuando termine el build. La primera creación requiere autorizar el acceso de Render al repositorio.

`OPENAI_API_KEY` es opcional para abrir la demo. Sin ella, o si OpenAI no puede responder, el chat entra en modo determinista: ante `Procesa el caso <id>` ejecuta las herramientas de lectura, mapeo, formulario y paquete sin modelo. Si no identifica un caso explícito, explica cómo continuar sin iniciar herramientas. Tras preparar un paquete, pide confirmación humana antes de crear `ENVIO-SIMULADO.md`. `/api/health` indica `configured: false` cuando no hay clave y anuncia que el respaldo está disponible. Para probar el modelo real, agrega la clave como variable secreta desde Render; nunca la escribas en el YAML ni la subas a GitHub.

La configuración usa el plan gratuito: el servicio puede suspenderse tras 15 minutos sin tráfico y tardar en despertar. Esta app mantiene sesiones en memoria y genera archivos en el disco efímero del servicio, por lo que sirve como demo compartible, no como almacenamiento persistente.

## Fixtures reales del reto

El demo usa `fixtures/demo/reto-01/`, que contiene exclusivamente datos sintéticos. Para procesar los casos reales, configura `DATA_DIR` a `./fixtures/reto-01`; el maestro y los soportes de ese directorio están excluidos de Git. Mantén los datos reales localmente y no los subas.
