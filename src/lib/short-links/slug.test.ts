import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLUG_LENGTH,
  generateShortSlug,
  getSlugCapacity,
  isValidSlug,
  normalizeSlugLength,
} from "./slug";

describe("short-link slugs", () => {
  it("gera slugs de quatro caracteres por padrão", () => {
    const slug = generateShortSlug();

    expect(DEFAULT_SLUG_LENGTH).toBe(4);
    expect(slug).toMatch(/^[A-Za-z0-9]{4}$/);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("mantém compatibilidade com slugs antigos e rejeita slugs curtos demais", () => {
    expect(isValidSlug("B7xK")).toBe(true);
    expect(isValidSlug("9WdM7FWW")).toBe(true);
    expect(isValidSlug("Ab3")).toBe(false);
  });

  it("normaliza configurações inválidas para quatro caracteres", () => {
    expect(normalizeSlugLength(3)).toBe(4);
    expect(normalizeSlugLength("4")).toBe(4);
  });

  it("oferece aproximadamente 14,7 milhões de combinações com quatro caracteres", () => {
    const capacity = getSlugCapacity(4);

    expect(capacity).toBeGreaterThan(BigInt(14_000_000));
    expect(capacity).toBeLessThanOrEqual(BigInt(14_776_336));
  });
});
