# Periferia AI Starter

Plantilla de preparación, **no solución del reto**.

## Local

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
cp .env.example .env
pnpm dev
```

Comprobar `http://localhost:3000/api/health`.

## Validación

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm demo
pnpm build
```

## Docker

```bash
docker compose up --build
```

El archivo `pnpm-lock.yaml` ya está incluido para que Docker y CI instalen las mismas versiones. Copiar los insumos del reto en `fixtures/reto-01/` cuando estén disponibles. No publicar secretos ni documentos reales; `inputs/` queda excluido de Git.

## GitHub

```bash
git add .
git commit -m "chore: initialize AI engineering starter"
gh repo create periferia-ai-starter --private --source=. --remote=origin --push
```

El endpoint `/api/chat` devuelve 501 intencionalmente y `demo.ts` es un placeholder: completar después de revisar el PRD y los casos. La carpeta `fixtures/` contiene solo marcadores mientras falten esos insumos.
