# Requisitos y trazabilidad del reto

Fuente: `upload/PRD.md`, versión 2.0 (2026-09-03). Este documento traduce el PRD a requisitos verificables para planear diseño, implementación y pruebas. Si una decisión aquí contradice el PRD, prevalece el PRD y se registra la corrección en este archivo.

## Alcance y prioridades

Construir una aplicación independiente de registro de proveedores con chat, backend, ciclo de agente, herramientas tipadas y adaptador LLM. Procesa los fixtures locales, prepara formularios y un paquete de revisión humana. No firma ni realiza envíos reales.

| Prioridad | Caso / capacidad | Resultado esperado |
|---|---|---|
| P0 | Excel: `co-industrias-delta` y `hn-agroexport-sula` | Generar `out/<caso>/formulario.xlsx`, llenando etiquetas y valores en la hoja y celdas declaradas por la plantilla. |
| P0 | Paquete para firma | Generar formulario, checklist de soportes y borrador de correo; informar si está listo para firma. |
| P0 | Leer solicitud y mapear campos | Identificar cliente, país, formato, campos y soportes; usar maestro y glosario sin inventar datos. |
| P1 | PDF: `ec-corp-andina` | Generar `out/<caso>/formulario.pdf` con campos etiquetados y valores en el orden solicitado. |
| P1 | Confirmación y envío simulado | Solo después de una confirmación explícita, crear `out/<caso>/ENVIO-SIMULADO.md`; nunca enviar externamente. |
| P2 | Portal: `pa-logistica-istmo` | No automatizar el portal; generar `out/<caso>/valores-portal.md` con datos copiables y documentar el diseño futuro. |

## Requisitos funcionales

| ID | Requisito verificable | Criterio de aceptación / evidencia | PRD |
|---|---|---|---|
| REQ-01 | Leer solicitud y plantilla de un caso por nombre, obteniendo país, cliente, formato, campos y soportes exigidos. | Una herramienta devuelve los datos normalizados del caso; caso inexistente o archivo corrupto produce error entendible y no termina la sesión. | HU-1, 7.1 |
| REQ-02 | Resolver sinónimos de etiquetas con `fixtures/reto-01/glosario-campos.json`. | Las etiquetas conocidas se mapean a claves del maestro; las desconocidas se reportan, no se adivinan. | HU-1, HU-2 |
| REQ-03 | Asignar a cada campo uno de estos estados: `lleno`, `faltante` o `requiere_confirmacion`. | Cada valor lleno indica su ruta de origen; mapeos ambiguos o con confianza menor a 0.8 requieren confirmación. | HU-2 |
| REQ-04 | Aplicar el identificador tributario según país: CO → NIT; EC, PE y PA → RUC; HN → RTN. | Si solo está disponible el NIT colombiano para un país extranjero, reportarlo como `requiere_confirmacion` con la nota exacta `identificador extranjero`. | RN1 |
| REQ-05 | No inventar valores y no exponer datos que las plantillas no soliciten. | Todo valor afirmado procede de una herramienta; los datos bancarios se incluyen solo si la plantilla pide explícitamente esos campos. No aparecen en el borrador de correo. | HU-2, RN2, CA2 |
| REQ-06 | Generar el formulario en el formato pedido. | Excel: ruta `out/<caso>/formulario.xlsx` con celdas especificadas. PDF: `out/<caso>/formulario.pdf` con etiqueta y valor por campo y en el orden dado. Portal: `out/<caso>/valores-portal.md` y respuesta de formato no soportado. | HU-3 |
| REQ-07 | Armar un paquete para firma con formulario, copias disponibles de soportes exigidos, `checklist.md` y `borrador-correo.md`. | Todo queda bajo `out/<caso>/paquete/`; el checklist distingue soportes presentes, ausentes y vencidos e incluye campos faltantes. | HU-4, RN3 |
| REQ-08 | Calcular la vigencia de soportes frente a la fecha de ejecución. | Soporte vencido o exigido ausente impide `listo_para_firma`; un campo faltante por sí solo no impide ese estado. | HU-4, RN3 |
| REQ-09 | Solicitar confirmación humana antes de una acción externa. | La confirmación debe ser explícita y provenir del mensaje inmediatamente anterior. En este reto, una confirmación válida solo crea `ENVIO-SIMULADO.md`; firma, carga a portal y envío real quedan fuera de alcance. | CA3, RN4 |
| REQ-10 | Exponer las herramientas del agente como funciones tipadas e importables desde `demo.ts`. | Cada herramienta tiene `description`, argumentos Zod descritos y `execute(args, ctx)`; devuelve JSON `{ ok: true, data }` o `{ ok: false, error }` y no propaga excepciones. | 6.2, HU-5 |
| REQ-11 | Ejecutar un ciclo de agente con tope configurable de iteraciones y manejo claro de fallos. | Al superar el tope, el agente responde con resultados y pendientes; errores del proveedor y de herramientas no matan la sesión. | 6.3, HU-5, 8 |
| REQ-12 | Mostrar en el chat historial, estado de espera, cada llamada a herramienta (nombre, argumentos y resumen del resultado) y solicitudes de confirmación. | Una persona puede revisar qué herramientas se ejecutaron y qué acción espera confirmación. | 6.1, CA3–CA5 |
| REQ-13 | Exponer API para conversar, recuperar sesiones y comprobar salud. | `POST /api/chat`, `GET /api/sessions/:id` y `GET /api/health` documentados; la respuesta de salud identifica proveedor/modelo sin incluir secretos. | 6.4 |
| REQ-14 | Registrar cada ejecución de herramienta. | Añadir en `out/<caso>/log.jsonl` `{ ts, herramienta, ok, resumen }`; los registros no contienen claves ni credenciales. | RN5, CA4 |
| REQ-15 | Ejecutar una demo determinista de herramientas sin proveedor LLM ni clave. | `pnpm demo` procesa todos los casos; limpia `out/` al iniciar y genera el mismo resultado funcional en ejecuciones consecutivas, salvo timestamps. | 6.6, 8 |

## Requisitos no funcionales y entrega

| ID | Requisito | Evidencia de aceptación | PRD |
|---|---|---|---|
| NFR-01 | Arranque local mediante un comando documentado. | `pnpm dev` levanta la aplicación; con variables de `.env.example`, una instalación limpia puede arrancar en menos de dos minutos. | 8, 9.2 |
| NFR-02 | Mantener secretos del modelo solo en variables de entorno del backend. | No hay secretos en frontend, repositorio, logs ni respuestas HTTP; `.env.example` contiene solo nombres y valores vacíos/de ejemplo no sensibles. | 8 |
| NFR-03 | No usar datos personales o credenciales reales y no ejecutar comandos de shell desde herramientas. | Revisión de fixtures, herramientas y logs confirma el uso de datos sintéticos y operaciones limitadas a archivos permitidos. | 8 |
| NFR-04 | Limitar iteraciones, tokens por sesión y tiempo de espera del proveedor. | Límites configurables; timeout y agotamiento de límites se comunican claramente. | 6.3, 8 |
| NFR-05 | Mantener código TypeScript legible y sin `any`; validar entradas con Zod. | `pnpm typecheck`, `pnpm lint` y pruebas pasan. | 6.1, 6.2, 8 |
| NFR-06 | Documentar arquitectura, ciclo, modelo y costo, diseño de portal, decisiones, supuestos, cobertura, uso de IA y riesgos en `SOLUCION.md`. | La documentación incluye las diez secciones exigidas por el PRD. | 9.1 |
| NFR-07 | Documentar instalación, variables, demo, URL desplegada y clave de acceso si aplica en `README.md`. | Una persona puede seguir el README para ejecutar y probar el proyecto. | 9.2–9.3 |
| NFR-08 | Mantener dependencias justificadas y usar Zod obligatoriamente para argumentos de herramientas. | `SOLUCION.md` explica dependencias principales; versiones del gestor coinciden entre manifest y CI. | 8 |

## Contratos y reglas de dominio que deben preservarse

- Nombres de herramientas visibles para el modelo: `<archivo>_<export>`. Contrato mínimo: `proveedor_leer_solicitud`, `proveedor_mapear_campos`, `proveedor_generar_formulario`, `proveedor_armar_paquete` y `proveedor_simular_envio`.
- El contexto de ejecución contiene la raíz del proyecto y el ID de sesión. Las rutas se resuelven desde la raíz, nunca desde rutas absolutas específicas de una máquina.
- Los fixtures son de solo lectura; los artefactos generados se escriben en `out/`.
- El prompt de sistema vive en `agent/prompt.md`; el conocimiento del proceso vive en `src/knowledge/`; las operaciones viven en `src/tools/`.
- El adaptador LLM implementa una interfaz propia para poder cambiar de proveedor sin reescribir el ciclo del agente.
- El paquete prepara la revisión y firma humana. No firma ni envía a clientes.

## Verificaciones pendientes antes de implementar el flujo completo

Estos puntos son de disponibilidad/interpretación de los insumos, no cambios al alcance del PRD:

1. Confirmar que están versionados todos los insumos de `fixtures/reto-01/`, en especial `repositorio/maestro.json`, `repositorio/soportes/index.json` y los archivos de soporte indicados por el índice.
2. Confirmar cómo se representan los archivos fuente Excel y PDF de los clientes. El PRD garantiza plantillas JSON de celdas/campos; no exige que los fixtures incluyan un XLSX/PDF original, y acepta generar el PDF desde cero.
3. Confirmar que el comando `pnpm demo` corresponde a `demo.ts` y que el output se limpia sin borrar fixtures u otros datos del usuario.
4. Completar trazabilidad de estos requisitos con rutas de implementación y pruebas conforme se construyan los specs 01–07. No marcar un requisito como hecho hasta que exista evidencia ejecutable o revisable.

## Criterio de cierre

El reto está listo para entrega cuando los requisitos P0 pasan desde la interfaz y desde `demo.ts`, las pruebas automatizadas cubren reglas de mapeo, seguridad, soporte y confirmación, P1/P2 están implementados o declarados con su estado real, CI pasa y README/SOLUCION describen fielmente el comportamiento entregado.