import { describe, expect, it } from "vitest";
import { getAllowedShortDomains, getDefaultShortDomain, normalizeShortDomain } from "../src/lib/config";
import { createGeobotLinkSchema } from "../src/lib/integrations/alcance-ia/schemas";

describe("short domains", () => {
  it("normalizes only root HTTPS domains", () => {
    expect(normalizeShortDomain("https://Curto.Ink/")).toBe("https://curto.ink");
    expect(normalizeShortDomain("http://curto.ink")).toBeNull();
    expect(normalizeShortDomain("https://curto.ink/path")).toBeNull();
  });
  it("uses the domains stored by the administrator", () => {
    const domains = getAllowedShortDomains(["https://encurta.io", "https://novo.link"]);
    expect(domains).toEqual(["https://encurta.io", "https://novo.link"]);
    expect(getDefaultShortDomain(domains, "https://novo.link")).toBe("https://novo.link");
  });
  it("accepts the optional domain in an integration request", () => {
    expect(createGeobotLinkSchema.safeParse({ destinationType: "url", destinationUrl: "https://example.com", shortDomain: "https://curto.ink" }).success).toBe(true);
  });
});
