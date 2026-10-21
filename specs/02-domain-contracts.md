# Contratos del dominio

## Propósito

Definir los tipos y resultados normalizados que comparten la aplicación, el agente y las herramientas.

Los archivos originales del reto pueden tener estructuras distintas a estos contratos. Una capa de lectura los adapta al modelo normalizado sin modificar las fixtures.

## Convenciones

- Los nombres de propiedades usan `camelCase`.
- Los países usan códigos ISO de dos letras en mayúscula.
- Las fechas de vigencia usan `YYYY-MM-DD` y se comparan como fechas calendario.
- Los tipos TypeScript se validan en tiempo de ejecución con esquemas Zod.
- Cuando sea posible, los tipos TypeScript se infieren de esos esquemas.
- Los ejemplos describen contratos; no son fixtures adicionales.
- Los objetos enviados al modelo no incluyen claves, credenciales ni información que la plantilla no solicite.

## Tipos base

~~~ts
type Pais = "CO" | "EC" | "PE" | "PA" | "HN";

type Formato = "xlsx" | "pdf" | "portal";

type EstadoCampo =
  | "lleno"
  | "faltante"
  | "requiere_confirmacion";

type EstadoSoporte =
  | "presente"
  | "ausente"
  | "vencido";

type ValorJson =
  | string
  | number
  | boolean
  | null
  | ValorJson[]
  | { [key: string]: ValorJson };
~~~

## Referencia de origen

Todo valor aceptado debe permitir identificar su fuente.

~~~ts
interface ReferenciaOrigen {
  archivo: string;
  rutaDato?: string;
  hoja?: string;
  celda?: string;
}
~~~

Reglas:

- `archivo` es una ruta relativa a la carpeta de fixtures autorizada.
- No se almacenan rutas absolutas de una máquina.
- `rutaDato` puede identificar la ruta del valor dentro de un JSON.
- `hoja` y `celda` se usan cuando la fuente es una plantilla o archivo tabular.
- La referencia no debe incluir el valor de secretos ni datos bancarios completos.

## Caso normalizado

La capa de lectura convierte los archivos de un caso en un objeto con la información necesaria para ejecutar el flujo.

~~~ts
interface CasoNormalizado {
  casoId: string;
  cliente: string;
  pais: Pais;
  formato: Formato;
  camposSolicitados: CampoSolicitado[];
  soportesRequeridos: SoporteRequerido[];
  referencias: ReferenciaOrigen[];
}
~~~

`casoId` identifica la carpeta del caso bajo `fixtures/reto-01/casos/`. La plantilla y los demás datos de origen pueden conservarse en estructuras internas adicionales si el flujo las necesita.

## Campo solicitado y resolución

~~~ts
interface CampoSolicitado {
  etiquetaOriginal: string;
  claveMaestro?: string;
  tipoDato?: string;
  ubicacion?: UbicacionCampo;
}

interface UbicacionCampo {
  hoja?: string;
  celdaEtiqueta?: string;
  celdaValor?: string;
  orden?: number;
}

type ResolucionCampo =
  | {
      estado: "lleno";
      valor: ValorJson;
      origen: ReferenciaOrigen;
      confianza?: number;
    }
  | {
      estado: "faltante";
      valor: null;
    }
  | {
      estado: "requiere_confirmacion";
      valorPropuesto?: ValorJson;
      origen?: ReferenciaOrigen;
      confianza?: number;
      motivo: string;
    };
~~~

Invariantes:

- Un campo `lleno` siempre tiene valor y origen.
- Un campo `faltante` no tiene valor propuesto ni origen inventado.
- Un campo `requiere_confirmacion` no se presenta como valor confirmado.
- `confianza`, cuando se informa, es un número entre `0` y `1`.
- Un mapeo con confianza menor a `0.8` requiere confirmación.
- La etiqueta original se conserva para que el resultado pueda revisarse.

## Soportes

~~~ts
interface SoporteRequerido {
  nombre: string;
  requerido: boolean;
  rutaEsperada?: string;
  vigenciaHasta?: string;
}

interface ResultadoSoporte {
  nombre: string;
  estado: EstadoSoporte;
  requerido: boolean;
  ruta?: string;
  vigenciaHasta?: string;
  motivo?: string;
}
~~~

Reglas:

- `ruta` es relativa a las fixtures o a la carpeta del paquete generado, según corresponda.
- `vigenciaHasta` usa `YYYY-MM-DD`.
- Un soporte requerido `ausente` o `vencido` bloquea `listoParaFirma`.
- Un soporte no requerido no bloquea ese estado.
- La fecha de ejecución se proporciona al servicio de validación; no se obtiene implícitamente dentro de una regla de dominio.

## Estado del paquete

~~~ts
interface EstadoPaquete {
  listoParaFirma: boolean;
  campos: Array<{
    etiquetaOriginal: string;
    claveMaestro?: string;
    resolucion: ResolucionCampo;
  }>;
  soportes: ResultadoSoporte[];
  pendientes: string[];
  bloqueos: string[];
}
~~~

Reglas:

- `listoParaFirma` es `false` si falta o está vencido un soporte requerido.
- También es `false` si no se pudo generar un formulario requerido.
- Un campo `faltante` o `requiere_confirmacion`, por sí solo, no bloquea el estado; debe aparecer en `pendientes`.
- `listoParaFirma` no significa que el sistema haya firmado, enviado o cargado documentos.
- `bloqueos` describe las razones que impiden dejar el paquete listo.

## Aprobación humana y resultado de ejecución

La aprobación se mantiene asociada a una acción y a un caso. Sus reglas de ciclo de vida están definidas en `specs/06-human-approval.md`.

~~~ts
type EstadoAprobacion =
  | "sin_confirmacion"
  | "esperando_confirmacion"
  | "aprobado"
  | "rechazado"
  | "expirado";

type ResultadoEjecucion =
  | "no_ejecutada"
  | "completada"
  | "fallida";

interface AprobacionHumana {
  accion: "simular_envio";
  casoId: string;
  estado: EstadoAprobacion;
  creadaEnTurno?: number;
  respondidaEnTurno?: number;
  resultadoEjecucion: ResultadoEjecucion;
}
~~~

Una aprobación válida solo permite crear `out/<caso>/ENVIO-SIMULADO.md`. El estado de aprobación y el resultado de ejecución son datos separados: `aprobado` no implica que el archivo se haya creado correctamente.

## Artefactos generados

~~~ts
type TipoArtefacto =
  | "formulario_xlsx"
  | "formulario_pdf"
  | "valores_portal"
  | "checklist"
  | "borrador_correo"
  | "envio_simulado";

interface ArtefactoGenerado {
  tipo: TipoArtefacto;
  ruta: string;
  creado: boolean;
}
~~~

Las rutas de artefactos se resuelven dentro de `out/<caso>/`. El tipo `envio_simulado` solo puede generarse con la aprobación definida en `specs/06-human-approval.md`.

## Resultado común de herramientas

Toda herramienta devuelve un resultado estructurado. El resultado se adapta a texto únicamente en el límite donde el proveedor LLM lo requiera.

~~~ts
type ResultadoHerramienta<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ErrorHerramienta;
    };

interface ErrorHerramienta {
  codigo:
    | "caso_inexistente"
    | "fixture_invalido"
    | "plantilla_invalida"
    | "campo_invalido"
    | "soporte_invalido"
    | "ruta_no_permitida"
    | "aprobacion_requerida"
    | "archivo_ya_existe"
    | "error_lectura"
    | "error_escritura"
    | "error_interno";
  mensaje: string;
  reintentable: boolean;
}
~~~

Reglas:

- Los errores no incluyen trazas internas, secretos ni contenido sensible.
- Las excepciones de implementación se convierten en `ResultadoHerramienta`.
- `reintentable` indica si repetir la misma operación puede tener sentido sin cambiar sus argumentos o condiciones.
- Las herramientas no devuelven `ok: true` si la operación no terminó y no verificó su resultado.

## Contexto de ejecución de herramientas

~~~ts
interface ToolContext {
  projectRoot: string;
  sessionId: string;
  executionDate: string;
}
~~~

Reglas:

- `projectRoot` es la raíz configurada del proyecto y solo se usa internamente.
- `executionDate` usa `YYYY-MM-DD`; permite pruebas reproducibles de vigencia.
- El contexto no expone variables de entorno, claves API ni acceso arbitrario a comandos.
- El estado de aprobación se obtiene del coordinador de aplicación o del contexto autorizado; no se acepta una aprobación inventada por el modelo.

## Criterios de aceptación

- Los datos del reto se normalizan sin modificar las fixtures.
- Cada campo tiene exactamente un estado permitido.
- Todo campo `lleno` contiene una referencia de origen.
- Ningún campo `faltante` se completa con una conjetura.
- Un campo `requiere_confirmacion` no se presenta como confirmado.
- Los soportes distinguen presencia, ausencia y vencimiento.
- El estado del paquete identifica pendientes y bloqueos sin afirmar que se realizó una firma o envío.
- Los resultados de herramientas distinguen éxito de error y usan códigos controlados.
- Los errores no exponen trazas, secretos ni datos sensibles innecesarios.
- La aprobación y el resultado de ejecución no se confunden.
- La creación de `ENVIO-SIMULADO.md` respeta `specs/06-human-approval.md`.