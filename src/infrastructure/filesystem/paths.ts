import path from "node:path";
import { lstat, mkdir, realpath } from "node:fs/promises";

export class SafePathError extends Error {
  constructor(message = "La ruta solicitada está fuera del directorio permitido.") {
    super(message);
    this.name = "SafePathError";
  }
}

export function resolveInside(root: string, ...segments: string[]): string {
  const base = path.resolve(root);
  const target = path.resolve(base, ...segments);
  const relative = path.relative(base, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new SafePathError();
  }
  return target;
}

export function resolveFixtureRoot(ctx: { projectRoot: string; fixtureRoot?: string }): string {
  const configured = ctx.fixtureRoot ?? "fixtures/reto-01";
  return resolveInside(ctx.projectRoot, configured);
}

export function validateCaseId(caseId: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(caseId) || caseId.includes("..")) {
    throw new SafePathError("El identificador del caso no es válido.");
  }
  return caseId;
}

export async function assertRealPathInside(root: string, target: string): Promise<string> {
  const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
  const relative = path.relative(realRoot, realTarget);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new SafePathError();
  return realTarget;
}

export async function ensureOutputDirectory(projectRoot: string, directory: string): Promise<string> {
  const base = path.resolve(projectRoot);
  const target = path.resolve(directory);
  const relative = path.relative(base, target);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new SafePathError();
  let current = base;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new SafePathError("La ruta de salida contiene un enlace o un elemento que no es directorio.");
    } catch (error) {
      if (error instanceof SafePathError) throw error;
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      await mkdir(current);
    }
    await assertRealPathInside(projectRoot, current);
  }
  return current;
}

export async function assertSafeWriteTarget(projectRoot: string, target: string): Promise<string> {
  const parent = path.dirname(target);
  await assertRealPathInside(projectRoot, parent);
  try {
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink() || !metadata.isFile()) throw new SafePathError("El destino de escritura existente no es un archivo regular.");
    await assertRealPathInside(projectRoot, target);
  } catch (error) {
    if (error instanceof SafePathError) throw error;
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  return target;
}
