import { describe, expect, it } from "vitest";
import {
  authenticateIntegrationRequest,
  isValidIntegrationRequestId,
  verifyIntegrationApiKey,
} from "../src/lib/integrations/alcance-ia/authenticate";
import {
  buildIntegrationSignaturePayload,
  createIntegrationSignature,
  safeEqual,
  sha256,
  verifyIntegrationSignature,
} from "../src/lib/integrations/alcance-ia/request-signature";
import {
  createInternalLinkSchema,
  updateInternalLinkSchema,
} from "../src/lib/integrations/alcance-ia/schemas";
import { prepareWhatsAppShortLink } from "../src/lib/short-links/service";
import { POST } from "../src/app/api/internal/v1/links/route";
import { PATCH } from "../src/app/api/internal/v1/links/[id]/route";

const apiKey = "test_api_key_with_at_least_24_chars";
const secret = "test_hmac_secret_with_at_least_32_characters";
const config = {
  enabled: true,
  apiKey,
  hmacSecret: secret,
  source: "alcance_ia",
  allowedOrigin: null,
  timeoutMs: 10000,
  maxClockSkewSeconds: 300,
  minuteLimit: 20,
  hourlyLimit: 200,
  dailyLimit: 1000,
  maxBodyBytes: 8192,
};

function signedRequest(
  body = '{"destinationType":"whatsapp","phone":"5571999999999"}',
  overrides: Record<string, string> = {},
) {
  const timestamp = overrides.timestamp ?? new Date().toISOString();
  const requestId = overrides.requestId ?? "req_01JABCDEF123456789";
  const path = "/api/internal/v1/links";
  const signature = createIntegrationSignature(secret, {
    timestamp,
    method: "POST",
    path,
    requestId,
    body,
  });
  return new Request(`https://encurta.io${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${overrides.apiKey ?? apiKey}`,
      "X-Integration-Source": overrides.source ?? "alcance_ia",
      "X-Request-Id": requestId,
      "X-Timestamp": timestamp,
      "X-Signature": overrides.signature ?? signature,
      "Content-Type": "application/json",
    },
    body,
  });
}

describe("API key", () => {
  it("accepts a valid bearer credential", () =>
    expect(verifyIntegrationApiKey(`Bearer ${apiKey}`, apiKey)).toBe(true));
  it("rejects invalid and duplicated credentials", () => {
    expect(verifyIntegrationApiKey("Bearer wrong", apiKey)).toBe(false);
    expect(
      verifyIntegrationApiKey(`Bearer ${apiKey}, Bearer ${apiKey}`, apiKey),
    ).toBe(false);
    expect(safeEqual("a", "b")).toBe(false);
  });
});

describe("HMAC", () => {
  it("builds and verifies the documented payload", () => {
    const body = "{}";
    const timestamp = new Date().toISOString();
    const input = {
      timestamp,
      method: "POST",
      path: "/api/internal/v1/links",
      requestId: "req_12345678",
      body,
    };
    expect(buildIntegrationSignaturePayload(input).split("\n").at(-1)).toBe(
      sha256(body),
    );
    expect(
      verifyIntegrationSignature(
        secret,
        createIntegrationSignature(secret, input),
        input,
      ),
    ).toBe(true);
  });
  it("rejects tampered body and signature", () => {
    const input = {
      timestamp: new Date().toISOString(),
      method: "POST",
      path: "/api/internal/v1/links",
      requestId: "req_12345678",
      body: "{}",
    };
    const signature = createIntegrationSignature(secret, input);
    expect(
      verifyIntegrationSignature(secret, signature, {
        ...input,
        body: '{"changed":true}',
      }),
    ).toBe(false);
    expect(verifyIntegrationSignature(secret, "md5=bad", input)).toBe(false);
  });
});

describe("request authentication", () => {
  it("authenticates all required headers", () =>
    expect(
      authenticateIntegrationRequest(
        signedRequest(),
        '{"destinationType":"whatsapp","phone":"5571999999999"}',
        config,
      ).source,
    ).toBe("alcance_ia"));
  it("rejects expired and future timestamps", () => {
    const body = '{"destinationType":"whatsapp","phone":"5571999999999"}';
    expect(() =>
      authenticateIntegrationRequest(
        signedRequest(undefined, {
          timestamp: new Date(Date.now() - 600000).toISOString(),
        }),
        body,
        config,
      ),
    ).toThrow("janela");
    expect(() =>
      authenticateIntegrationRequest(
        signedRequest(undefined, {
          timestamp: new Date(Date.now() + 600000).toISOString(),
        }),
        body,
        config,
      ),
    ).toThrow("janela");
  });
  it("validates request IDs", () => {
    expect(isValidIntegrationRequestId("req_01JABCDEF")).toBe(true);
    expect(isValidIntegrationRequestId("bad")).toBe(false);
  });
});

describe("production hosts", () => {
  it("accepts the official www host", () => {
    const body = '{"destinationType":"whatsapp","phone":"5571999999999"}';
    const timestamp = new Date().toISOString();
    const requestId = "req_www_host_123";
    const path = "/api/internal/v1/links";
    const signature = createIntegrationSignature(secret, {
      timestamp,
      method: "POST",
      path,
      requestId,
      body,
    });
    const request = new Request(`https://www.encurta.io${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Integration-Source": "alcance_ia",
        "X-Request-Id": requestId,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "Content-Type": "application/json",
      },
      body,
    });
    expect(authenticateIntegrationRequest(request, body, config).source).toBe(
      "alcance_ia",
    );
  });
});

describe("strict link schemas", () => {
  it("accepts a valid optional slug on creation", () => {
    expect(
      createInternalLinkSchema.safeParse({
        destinationType: "whatsapp",
        phone: "(71) 99999-9999",
        slug: "MinhaCampanha",
        message: "Olá 👋",
      }).success,
    ).toBe(true);
  });
  it("accepts a slug-only update", () => {
    expect(updateInternalLinkSchema.safeParse({ slug: "NovoSlug" }).success).toBe(
      true,
    );
  });
  it("rejects reserved, malformed and extra fields", () => {
    expect(updateInternalLinkSchema.safeParse({ slug: "admin" }).success).toBe(
      false,
    );
    expect(updateInternalLinkSchema.safeParse({ slug: "bad-slug" }).success).toBe(
      false,
    );
    expect(
      updateInternalLinkSchema.safeParse({ slug: "Valid123", status: "active" })
        .success,
    ).toBe(false);
  });
  it("rejects arbitrary URL, legacy customSlug and invalid phone", () => {
    expect(
      createInternalLinkSchema.safeParse({
        destinationType: "whatsapp",
        phone: "71999999999",
        destinationUrl: "https://evil.test",
      }).success,
    ).toBe(false);
    expect(
      createInternalLinkSchema.safeParse({
        destinationType: "whatsapp",
        phone: "71999999999",
        customSlug: "custom123",
      }).success,
    ).toBe(false);
    expect(
      createInternalLinkSchema.safeParse({
        destinationType: "whatsapp",
        phone: "123",
      }).success,
    ).toBe(false);
  });
});

describe("shared WhatsApp service", () => {
  it("normalizes safely and preserves encoded text", () => {
    const link = prepareWhatsAppShortLink({
      phone: "+55 71 99999-9999",
      message: "Olá 👋\nTudo bem?",
    });
    expect(link.destinationUrl).toMatch(
      /^https:\/\/wa\.me\/5571999999999\?text=/,
    );
    expect(link.destinationUrl).not.toContain("<script>");
  });
  it("rejects control characters and invalid expiration", () => {
    expect(() =>
      prepareWhatsAppShortLink({
        phone: "71999999999",
        message: "bad\u0000text",
      }),
    ).toThrow("INVALID_MESSAGE");
    expect(() =>
      prepareWhatsAppShortLink({
        phone: "71999999999",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
    ).toThrow("INVALID_EXPIRATION");
  });
});

describe("route security defaults", () => {
  it("starts POST disabled and never caches the response", async () => {
    const response = await POST(
      new Request("https://encurta.io/api/internal/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"destinationType":"whatsapp","phone":"71999999999"}',
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("SUPABASE");
  });
  it("starts PATCH disabled and never exposes internals", async () => {
    const response = await PATCH(
      new Request(
        "https://encurta.io/api/internal/v1/links/00000000-0000-4000-8000-000000000000",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: '{"slug":"NovoSlug"}',
        },
      ),
      {
        params: Promise.resolve({
          id: "00000000-0000-4000-8000-000000000000",
        }),
      },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("SUPABASE");
  });
  it("rejects an oversized body before authentication", async () => {
    const response = await POST(
      new Request("https://encurta.io/api/internal/v1/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "x".repeat(9000) }),
      }),
    );
    expect(response.status).toBe(413);
  });
});
