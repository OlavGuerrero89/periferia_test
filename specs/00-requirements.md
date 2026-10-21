# Requirements
# 00 — Requisitos y alcance

## Objetivo

Construir un agente conversacional que lea solicitudes de clientes, consulte el
repositorio maestro de Periferia, resuelva los campos requeridos y complete
formularios Excel o PDF para preparar un paquete de documentos para firma.

## Entradas

- Solicitud del cliente y país correspondiente.
- Formulario o plantilla que se debe completar.
- Repositorio maestro con los datos corporativos y soportes.
- Índice de vigencias de los documentos.
- Glosario de sinónimos para relacionar las etiquetas del cliente con las claves maestras.

Los formatos y campos exactos deben documentarse a partir del PRD y los fixtures
entregados para el reto.

## Flujo esperado

1. Validar la solicitud y sus archivos.
2. Identificar país, formulario y campos solicitados.
3. Resolver las etiquetas usando el glosario.
4. Consultar el repositorio maestro y comprobar vigencia y disponibilidad de cada dato.
5. Mostrar los valores resueltos junto con su fuente y señalar faltantes, ambigüedades o conflictos.
6. Solicitar confirmación humana cuando las reglas lo requieran.
7. Generar copias completadas y el paquete final sin alterar los originales.

## Comportamiento obligatorio

- No inventar datos corporativos ni completar valores sin evidencia.
- No usar soportes vencidos como si fueran vigentes.
- Marcar explícitamente campos faltantes, ambiguos o contradictorios.
- Mantener trazabilidad entre cada valor generado y su fuente.
- La demo debe poder ejecutar las herramientas directamente, sin consumir un LLM.
- El chat debe mostrar las llamadas a herramientas y las solicitudes de confirmación humana.

## Entregables

- Repositorio de código fuente con arquitectura modular.
- Interfaz de chat funcional.
- `demo.ts` para verificar los casos de forma determinista y sin LLM.
- URL pública funcional para la defensa técnica.
- `SOLUCION.md` con arquitectura, ciclo del agente, decisiones de diseño,
  costos del modelo y consideraciones de producción.

## Criterios de aceptación

- Una solicitud válida resuelve los campos disponibles y muestra sus fuentes.
- Los campos sin datos no se inventan.
- Los casos ambiguos, contradictorios o con soportes vencidos se identifican.
- Los formularios generados se pueden abrir y los originales permanecen intactos.
- Los casos de prueba se pueden repetir y producen resultados consistentes.

## Pendiente de confirmar con el PRD y los fixtures

- Campos obligatorios y reglas específicas por país.
- Esquemas exactos de solicitudes, formularios y documentos.
- Reglas completas de vigencia.
- Casos que exigen aprobación humana y momento de aprobación.
- Formatos y estructura del paquete final.
Pegar y trazar los requisitos del PRD. Estado: pendiente.
