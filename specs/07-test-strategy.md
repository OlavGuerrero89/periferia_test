# Estrategia de pruebas

## Propósito

Definir cómo verificar los requisitos y las reglas del reto desde las funciones de dominio hasta la API, la interfaz y la demo.

Las pruebas usan datos sintéticos. La suite automatizada no requiere una clave de proveedor LLM ni depende de servicios externos.

## Principios

- Las reglas de dominio se prueban sin Next.js, llamadas de red ni un modelo LLM.
- Las fechas de prueba son fijas e inyectadas.
- Las pruebas de herramientas usan fixtures sintéticas y directorios temporales.
- Ninguna prueba escribe fuera de un directorio temporal o de `out/`.
- Las fixtures entregadas por el reto se tratan como solo lectura.
- Las pruebas verifican resultados y efectos en archivos, no solo que una función no lance errores.
- Los errores deben tener resultados controlados y comprobables.
- El ciclo del agente usa un adaptador LLM falso con respuestas predeterminadas.
- Las pruebas automatizadas no llaman proveedores, portales ni destinatarios reales.

## Niveles de prueba

### Unitarias de dominio

Verifican, como mínimo:

- Normalización de país, formato y etiquetas.
- Resolución de etiquetas y sinónimos documentados.
- Estados `lleno`, `faltante` y `requiere_confirmacion`.
- Procedencia requerida para un campo `lleno`.
- Umbral de confianza menor a `0.8` y caso límite igual a `0.8`.
- Identificador tributario por país y nota exacta `identificador extranjero`.
- Comparación de fechas de vigencia, incluida la fecha igual a `vigencia_hasta`.
- Cálculo de `listo_para_firma`.
- Exclusión y enmascaramiento de datos bancarios.

### Integración de herramientas

Cada herramienta se prueba contra un filesystem temporal:

- Leer un caso válido.
- Manejar caso inexistente, JSON inválido y plantilla incompleta.
- Mapear un campo conocido, uno desconocido y uno ambiguo.
- Generar Excel usando exclusivamente la hoja y las celdas indicadas.
- Generar PDF con campos en el orden esperado.
- Generar Markdown para portal sin automatizar acceso al portal.
- Crear el paquete con soportes presentes, ausentes y vencidos.
- Impedir lectura fuera de las fixtures y escritura fuera de `out/`.
- Verificar que las fixtures no cambian.
- Validar el contenido y formato de `log.jsonl`.
- Impedir crear `ENVIO-SIMULADO.md` sin aprobación válida.
- Manejar errores de lectura y escritura sin reportar éxito.

### Aprobación humana

Con un estado de sesión controlado, verificar:

- No existe acción pendiente y el usuario responde “sí”.
- El usuario confirma en el turno inmediatamente posterior para el mismo caso.
- El usuario rechaza la acción.
- La respuesta es ambigua.
- La respuesta corresponde a otro caso.
- La aprobación llega después de otro turno y la solicitud ya expiró.
- La misma confirmación se procesa más de una vez.
- El archivo de salida ya existe.
- El archivo solo se crea en `out/<caso>/ENVIO-SIMULADO.md`.
- Ningún caso de prueba realiza envío, firma o carga externa.

### Ciclo del agente

Con un adaptador LLM falso, verificar:

- Una respuesta final sin llamadas a herramientas.
- Una llamada a herramienta seguida de respuesta final.
- Varias llamadas a herramientas dentro del límite configurado.
- Argumentos inválidos rechazados por el esquema.
- Fin del ciclo al alcanzar el límite de iteraciones.
- Error del proveedor y timeout representados como errores controlados.
- La respuesta incluye las llamadas a herramientas que deben mostrarse.
- Las herramientas solo usan los datos devueltos por fuentes autorizadas.
- El agente no completa valores usando conocimiento general.
- La aprobación válida, ambigua, rechazada, expirada y asociada a otro caso.

### API

Verificar:

- `POST /api/chat` acepta una entrada válida y rechaza una inválida.
- `GET /api/sessions/:id` devuelve el historial correcto o un error claro.
- `GET /api/health` devuelve el estado sin exponer secretos.
- Los errores HTTP conservan una estructura estable.
- Las rutas no exponen trazas internas ni variables de entorno.
- La respuesta expone el estado de confirmación sin afirmar que una acción fallida fue completada.

### Interfaz

Verificar manualmente o con pruebas de interfaz que:

- Se muestra el historial de mensajes.
- Se muestra el indicador de espera durante una respuesta.
- Las llamadas a herramientas se presentan con resultados resumidos.
- La solicitud de confirmación identifica la acción y el caso.
- Los errores se muestran con lenguaje claro.
- La interfaz no presenta acciones no realizadas como exitosas.
- No se muestran claves, secretos ni datos bancarios innecesarios.

### Demo sin modelo

Ejecutar `pnpm demo` sin clave de proveedor y verificar que:

- Procesa todos los casos disponibles.
- Usa las mismas herramientas del servidor.
- Limpia únicamente su propio directorio de salida.
- Imprime un resumen por caso y sus pendientes.
- No escribe sobre fixtures.
- Produce resultados funcionales iguales entre ejecuciones, salvo timestamps y datos de auditoría variables.

## Matriz mínima de cobertura

| Área | Casos mínimos |
|---|---|
| Lectura | Caso válido, caso inexistente, solicitud inválida y plantilla inválida |
| Mapeo | Coincidencia documentada, sinónimo, campo faltante, ambigüedad y confianza bajo el umbral |
| Identificadores | CO, EC, PE, PA y HN; comprobar propuesta extranjera y nota requerida |
| Excel | Hoja y celda correctas, valor faltante sin completar y fixtures sin cambios |
| PDF | Orden de campos, pendientes visibles y archivo generado válido |
| Portal | Markdown copiable y ausencia de login, carga o envío automatizados |
| Soportes | Presente vigente, ausente, vencido y sin fecha de vigencia |
| Paquete | Soporte ausente o vencido bloquea firma; campo faltante por sí solo no |
| Datos sensibles | Dato bancario no solicitado excluido; número completo ausente de logs |
| Rutas | Traversal de rutas, rutas absolutas y nombres de archivo no permitidos |
| Confirmación | Sin solicitud, aprobación inmediata, rechazo, ambigüedad, otro caso y vencimiento |
| Robustez | Error de herramienta, error LLM, timeout y límite de iteraciones |
| Demo | Sin API key, varios casos, repetición y limpieza segura de salida |

## Fixtures y datos de prueba

- Usar exclusivamente datos sintéticos.
- No sobrescribir ni modificar fixtures entregadas por el reto.
- Para escenarios de error, crear copias temporales o fixtures pequeñas dentro de `tests/fixtures/`.
- Inyectar la fecha de ejecución para las pruebas de vigencia.
- Usar directorios temporales para probar las escrituras.
- Limpiar los directorios temporales al terminar, incluso si una prueba falla.
- No guardar secretos ni datos personales reales en snapshots, logs o fixtures de prueba.

## Comandos de verificación

La verificación de entrega debe ejecutar, cuando esos scripts estén definidos en `package.json`:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test`
5. `pnpm demo`
6. `pnpm build`

La instalación y CI deben usar la versión de pnpm fijada por el proyecto. En este repositorio, esa versión debe permanecer sincronizada con `package.json` y el workflow de CI.

## Criterios de salida

La entrega se considera verificada cuando:

- Los comandos de verificación terminan correctamente.
- Las reglas P0 tienen pruebas automatizadas.
- La demo funciona sin clave LLM.
- Las pruebas no modifican fixtures ni escriben fuera de las rutas permitidas.
- No hay pruebas automatizadas que dependan de servicios externos.
- Las funciones de aprobación y envío simulado cumplen `specs/06-human-approval.md`.
- Los requisitos parciales o pendientes aparecen en `README.md` o `SOLUCION.md`.
- No se declara implementada una funcionalidad que solo esté descrita o simulada.