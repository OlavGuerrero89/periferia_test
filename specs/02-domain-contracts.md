# Contratos del dominio

## Propósito

Definir los datos y resultados que comparten la aplicación, el agente y las herramientas. Estos contratos se basan en `upload/PRD.md`. Las reglas de negocio se validan en el dominio; el proveedor LLM y Next.js no definen los tipos del dominio.

## Convenciones

- Los nombres de propiedades del dominio usan `camelCase`. Los archivos JSON de fixtures conservan la estructura entregada por el reto.
- Los países se representan con códigos ISO de dos letras en mayúscula.
- Las fechas de vigencia usan `YYYY-MM-DD` y se comparan como fechas calendario, no como instantes con hora.
- Los objetos entregados al modelo y las respuestas de API no incluyen claves, credenciales ni datos que no solicite la plantilla.
- Los esquemas Zod son la validación de entrada en tiempo de ejecución; los tipos TypeScript se infieren de ellos siempre que sea posible.
- Los ejemplos de este documento describen el contrato, no son fixtures adicionales.

## Tipos base

```ts
type Pais = "CO" | "EC" | "PE" | "PA" | "HN";

type Formato = "xlsx" | "pdf" | "portal";

type EstadoCampo =
  | "lleno"
  | "faltante"
  | "requiere_confirmacion";

type ValorJson =
  | string
  | number
  | boolean
  | null
  | ValorJson[]
  | { [key: string]: ValorJson };