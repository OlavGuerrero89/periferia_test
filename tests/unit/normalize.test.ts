import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/domain/rules/normalize";
describe("normalizeLabel", () => { it("normaliza acentos y espacios", () => { expect(normalizeLabel("  Razón   Social ")).toBe("razon social"); }); });
