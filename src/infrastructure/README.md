# Infraestructura

- `filesystem/case-data.ts`: carga y valida fixtures desde `DATA_DIR`, resuelve etiquetas con el glosario y clasifica soportes.
- `filesystem/artifacts.ts`: genera Excel, PDF y valores copiables; prepara el paquete sin modificar las fuentes.
- `filesystem/paths.ts`: limita IDs, verifica rutas reales y bloquea enlaces simbólicos en rutas de salida.
- `llm/adapter.ts`: adaptador OpenAI independiente del ciclo del agente; las credenciales se leen del entorno del servidor.
- `logging/audit.ts`: agrega eventos JSONL sin registrar datos de negocio.
