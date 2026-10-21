# Confirmación y aprobación humana

## Propósito

Definir los límites de autonomía del agente y cómo se representa la confirmación humana. El sistema prepara información y archivos para revisión; la persona decide si procede con una acción simulada.

## Acciones permitidas y no permitidas

| Acción | Comportamiento |
|---|---|
| Leer solicitud, plantilla, maestro y soportes | Permitido mediante herramientas del reto. |
| Mapear campos y generar documentos locales | Permitido dentro de las reglas de validación. |
| Armar paquete para revisión | Permitido; no equivale a aprobación ni firma. |
| Crear `ENVIO-SIMULADO.md` | Permitido únicamente tras confirmación explícita e inmediata. |
| Enviar correo o documentos a un cliente | No implementado. |
| Firmar documentos | No implementado. |
| Ingresar a un portal o cargar archivos | No implementado. |

## Estados de aprobación

La aplicación maneja, como mínimo, estos estados:

- `sin_confirmacion`: no hay acción pendiente de aprobación.
- `esperando_confirmacion`: el agente preguntó explícitamente si debe crear el envío simulado.
- `confirmado`: el mensaje inmediatamente siguiente confirmó la acción y el caso correcto.
- `rechazado`: el usuario negó la acción.
- `expirado`: llegó otro turno, cambió el caso o la acción dejó de estar pendiente.

La confirmación se asocia a una acción y un caso:

~~~ts
interface ConfirmacionPendiente {
  accion: "simular_envio";
  caso: string;
  estado: "esperando_confirmacion";
  creadaEnTurno: number;
}