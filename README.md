# Registro de proveedores — Periferia

Aplicación independiente para leer solicitudes de registro, mapear campos con fuente verificable, generar formularios y preparar un paquete para revisión humana. No firma, no envía documentos y no inicia sesión ni carga archivos en portales.

## Estado de esta versión

- Chat web y API con sesión en memoria.
- Agente con herramientas tipadas y validadas con Zod, adaptador OpenAI configurable y límite de iteraciones/tokens.
- Excel P0, PDF P1 y valores copiables para portal P2.
- Checklist de soportes, borrador de correo, auditoría JSONL y confirmación inmediata para crear el envío simulado local.
- Incluye los cuatro casos del reto (`co-industrias-delta`, `ec-corp-andina`, `hn-agroexport-sula` y `pa-logistica-istmo`) con un maestro y soportes enteramente sintéticos. No contiene documentos ni datos bancarios reales.
- Incluye el módulo reusable en `modulo/`: prompt, skill del proceso y herramientas importables sin iniciar el servidor Next.js.
- La demo pública y `pnpm demo` usan directamente estos mismos cuatro IDs de caso, con valores y soportes sintéticos.

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

Abre [http://localhost:3000](http://localhost:3000). Prueba: `Procesa el caso ec-corp-andina. Dime qué campos quedaron llenos, cuáles faltan y qué soportes debo actualizar. No envíes nada todavía`.

## Variables de entorno

| Variable | Uso | Valor de ejemplo |
|---|---|---|
| `OPENAI_API_KEY` | Clave del proveedor, solo en servidor. | Vacío en `.env.example` |
| `OPENAI_MODEL` | Modelo de chat y llamadas a herramientas. | `gpt-6-luna` |
| `DATA_DIR` | Ruta relativa al proyecto con `casos/`, `repositorio/` y el glosario. | `./fixtures/reto-01` |
| `DATA_DIR_HOST` | Directorio de fixtures montado como solo lectura por Docker Compose. | `./fixtures/reto-01` |
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
  const result = await executeTool(tool, { casoId: "ec-corp-andina" }, context);
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

La demo pública está disponible en [https://periferia-test-demo.onrender.com](https://periferia-test-demo.onrender.com/). El servicio Docker de Render usa la rama `codex/fix-specs-ci`, monta `fixtures/reto-01` y comprueba su estado en `/api/health`. Prueba el caso `ec-corp-andina`, también usado como ejemplo en la sección 11 del PRD.

`OPENAI_API_KEY` es opcional para abrir la demo. Sin ella, o si OpenAI no puede responder, el chat entra en modo determinista: ante `Procesa el caso <id>` ejecuta las herramientas de lectura, mapeo, formulario y paquete sin modelo. Si no identifica el caso explícito, explica cómo continuar sin iniciar herramientas. Tras preparar un paquete, pide confirmación humana antes de crear `ENVIO-SIMULADO.md`. `/api/health` informa si la clave está configurada y anuncia que el respaldo está disponible; `configured: true` no garantiza cuota del proveedor. En la última prueba pública, OpenAI devolvió un error de cuota y el caso se completó con el respaldo determinista. Para probar el flujo generativo, la cuenta de API debe tener cuota disponible. Nunca escribas la clave en el YAML ni la subas a GitHub.

La configuración usa el plan gratuito: el servicio puede suspenderse tras 15 minutos sin tráfico y tardar en despertar. Esta app mantiene sesiones en memoria y genera archivos en el disco efímero del servicio, por lo que sirve como demo compartible, no como almacenamiento persistente.

## Fixtures del reto

`fixtures/reto-01/` incluye las cuatro solicitudes y plantillas del reto, un maestro de prueba inventado y soportes placeholder marcados como sintéticos. Los valores de identidad, contacto y cuenta bancaria son ficticios; no los uses en transacciones reales. Si reemplazas estos datos con información real, no la subas al repositorio ni la despliegues en la demo pública.
