---
name: registro-proveedor
description: Reglas del proceso de registro de proveedores, trazabilidad de datos, validación de soportes y cierre con aprobación humana.
---

# Conocimiento del proceso de registro

El agente prepara el registro de proveedores usando solicitudes, plantillas, el repositorio maestro y un índice de soportes. Los valores deben conservar una referencia a su archivo y ruta de origen.

## Identificadores tributarios

El país determina el identificador solicitado: Colombia (CO), NIT; Ecuador (EC), RUC; Perú (PE), RUC; Panamá (PA), RUC; Honduras (HN), RTN. El NIT colombiano no se debe presentar como si fuera un RUC o RTN extranjero. Si es el único dato disponible para otro país, se marca `requiere_confirmacion` con la nota exacta `identificador extranjero`.

## Soportes y cierre

Un soporte exigido debe existir en el índice y en disco. Si tiene `vigencia_hasta` anterior a la fecha de ejecución de Bogotá, está vencido; si la fecha coincide, sigue vigente ese día. Un soporte exigido ausente o vencido impide marcar el paquete `listo_para_firma`. Los campos faltantes se listan, pero no bloquean por sí solos ese estado.

El paquete es material para revisión humana. No representa una firma, un envío ni una carga en un portal. El envío simulado solo crea un archivo local después de una aprobación explícita e inmediata para el mismo caso.
