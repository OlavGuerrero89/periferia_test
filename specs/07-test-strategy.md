
## `D:\Joyita_hub\periferia_test\specs\07-test-strategy.md`

~~~markdown
# Estrategia de pruebas

## Propósito

Verificar las reglas del reto desde las unidades pequeñas hasta la interfaz y la demo. Las pruebas usan datos sintéticos y no requieren una clave de proveedor LLM, salvo pruebas manuales específicas del adaptador real.

## Principios

- Las reglas de dominio deben probarse sin Next.js ni llamadas de red.
- Las pruebas usan fechas fijas para evaluar vencimientos.
- Las pruebas de herramientas usan fixtures sintéticos y directorios temporales de salida.
- Ninguna prueba escribe fuera de un directorio temporal o de `out/`.
- Los errores se prueban como resultados controlados, no solo como excepciones.
- Las pruebas del ciclo del agente usan un adaptador LLM falso y respuestas predeterminadas.
- Las pruebas de integración no dependen de servicios externos.

## Niveles de prueba

### Unitarias de dominio

Cubren:

- normalización de país, formato y etiquetas;
- resolución de sinónimos del glosario;
- asignación de estados de campo;
- umbral de confianza `< 0.8`;
- regla de identificador tributario por país;
- nota exacta `identificador extranjero`;
- comparación de fechas de vigencia;
- cálculo de `listo_para_firma`;
- filtrado de campos bancarios.

### Integración de herramientas

Cubren cada herramienta con filesystem temporal:

- leer un caso válido;
- manejar caso inexistente, JSON corrupto y plantilla incompleta;
- mapear un campo conocido, uno desconocido y uno ambiguo;
- generar Excel, PDF y Markdown de portal;
- crear el paquete con soportes presentes, ausentes y vencidos;
- impedir rutas fuera de `out/`;
- validar el registro JSONL;
- impedir la simulación de envío sin confirmación.

### Ciclo del agente

Con un adaptador LLM falso, verificar:

- una respuesta final sin herramientas;
- una llamada a herramienta seguida de respuesta final;
- varias herramientas en un turno;
- validación de argumentos inválidos;
- límite de iteraciones;
- error del proveedor y timeout;
- inclusión de llamadas en la respuesta del chat;
- confirmación válida, ambigua, rechazada, expirada y para otro caso.

### API

Verificar:

- `POST /api/chat` acepta una entrada válida y rechaza una inválida;
- `GET /api/sessions/:id` devuelve el historial correcto o un error claro;
- `GET /api/health` devuelve estado y modelo sin incluir secretos;
- errores HTTP tienen forma estable;
- las rutas no exponen trazas internas ni variables de entorno.

### Interfaz

Verificar manualmente o con pruebas de interfaz que:

- se ve el historial de mensajes;
- se muestra el indicador de espera;
- se muestran las llamadas a herramientas y su resultado resumido;
- la confirmación se destaca y nombra la acción y el caso;
- los errores son legibles;
- la interfaz no incluye claves ni variables privadas.

### Demo sin modelo

Ejecutar `pnpm demo` sin clave de proveedor y verificar:

- procesa todos los casos disponibles;
- llama directamente a las mismas herramientas del servidor;
- limpia solo su propio directorio de salida;
- imprime resumen por caso;
- resultados funcionales iguales entre ejecuciones, salvo timestamps.

## Matriz de cobertura inicial

| Área | Casos mínimos |
|---|---|
| Lectura | caso válido, caso ausente, solicitud inválida, plantilla inválida |
| Mapeo | coincidencia exacta, sinónimo, faltante, confianza menor a 0.8, identificador extranjero |
| Excel | escribe en hoja/celda indicada, no modifica fixtures, campo faltante sin valor inventado |
| PDF | conserva orden, etiqueta campos faltantes, genera archivo válido |
| Portal | crea Markdown copiable y no automatiza login |
| Soportes | presente vigente, ausente, vencido, sin fecha de vigencia |
| Paquete | soporte ausente bloquea firma, vencido bloquea firma, campo faltante solo no bloquea |
| Seguridad | traversal de rutas, secretos en respuesta/log, datos bancarios no solicitados |
| Confirmación | sin pregunta, confirmación inmediata, ambigua, rechazada, caso distinto, confirmación vencida |
| Robustez | error de herramienta, error LLM, timeout, límite de iteraciones |
| Demo | sin API key, múltiples ejecuciones, limpieza segura de `out/` |

## Fixtures y datos de prueba

- Usar solo datos sintéticos.
- No sobrescribir fixtures entregados por el reto.
- Para casos de error, crear copias temporales o fixtures pequeños dentro de `tests/fixtures/`.
- Inyectar `fechaEjecucion` para no depender del día en que se corren las pruebas.
- Eliminar los directorios temporales al terminar incluso cuando una prueba falla.

## Criterios de salida

Antes de considerar lista una entrega:

1. `pnpm typecheck` termina sin errores.
2. `pnpm lint` termina sin errores.
3. `pnpm test` pasa todas las pruebas automatizadas.
4. `pnpm demo` corre sin clave LLM.
5. `pnpm build` termina correctamente.
6. CI corre los mismos comandos con la versión de pnpm fijada en `package.json`.
7. Las reglas P0 tienen pruebas automatizadas.
8. Cualquier requisito parcial o pendiente aparece declarado en README o `SOLUCION.md`; no se presenta como implementado.