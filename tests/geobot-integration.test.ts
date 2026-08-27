import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { POST } from "../src/app/api/internal/v1/links/route";
import { GET, PATCH } from "../src/app/api/internal/v1/links/[id]/route";
import { getGeobotEnvConfig } from "../src/lib/integrations/config";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({
  getServiceClient: () => mocks,
}));
const id = "00000000-0000-4000-8000-000000000001";
const credentials = {
  geobot: {
    key: "geobot_test_key_with_24_characters",
    secret: "geobot_test_secret_with_32_characters",
  },
  alcance_ia: {
    key: "alcance_test_key_with_24_characters",
    secret: "alcance_test_secret_with_32_characters",
  },
};
const row = {
  id,
  link_id: id,
  slug: "GeoTest",
  status: "active",
  link_status: "active",
  created_at: "2026-08-27T00:00:00.000Z",
  expires_at: null,
};
let owner = "geobot";
let destinationType = "whatsapp";
let flags: Record<string, unknown>;
let events: Record<string, unknown>[];

function request(
  method = "POST",
  source: keyof typeof credentials = "geobot",
  body?: string,
  signingSource = source,
) {
  const raw =
    body ??
    (method === "POST"
      ? JSON.stringify({
          destinationType: "whatsapp",
          phone: "5571999999999",
          message: "Olá 👋",
        })
      : method === "PATCH"
        ? '{"slug":"NovoSlug"}'
        : "");
  const path = `/api/internal/v1/links${method === "POST" ? "" : `/${id}`}`;
  const requestId = "geobot_test_request_123";
  const timestamp = new Date().toISOString();
  // Independent implementation matches the Geobot client wire protocol.
  const signature =
    "sha256=" +
    createHmac("sha256", credentials[signingSource].secret)
      .update(
        [
          timestamp,
          method,
          path,
          requestId,
          createHash("sha256").update(raw).digest("hex"),
        ].join("\n"),
      )
      .digest("hex");
  return new Request(`https://www.encurta.io${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials[signingSource].key}`,
      "X-Integration-Source": source,
      "X-Request-Id": requestId,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    ...(method !== "GET" ? { body: raw } : {}),
  });
}
const context = () => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  owner = "geobot";
  destinationType = "whatsapp";
  events = [];
  flags = {};
  for (const [source, prefix] of [
    ["geobot", "GEOBOT"],
    ["alcance_ia", "ALCANCE_IA"],
  ] as const) {
    vi.stubEnv(`${prefix}_INTEGRATION_ENABLED`, "true");
    vi.stubEnv(`${prefix}_API_KEY`, credentials[source].key);
    vi.stubEnv(`${prefix}_HMAC_SECRET`, credentials[source].secret);
    flags[`integrations.${source}.enabled`] = true;
    flags[`integrations.${source}.creation_enabled`] = true;
  }
  vi.stubEnv("ALCANCE_IA_ALLOWED_SOURCE", "alcance_ia");
  mocks.from.mockImplementation((table: string) => {
    if (table === "app_settings")
      return {
        select: async () => ({
          data: Object.entries(flags).map(([key, value]) => ({ key, value })),
          error: null,
        }),
      };
    if (table === "integration_api_events")
      return {
        insert: async (event: Record<string, unknown>) => {
          events.push(event);
          return { error: null };
        },
      };
    if (table === "short_links")
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: { ...row, integration_source: owner, destination_type: destinationType },
                error: null,
              }),
            }),
          }),
        }),
      };
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name.startsWith("check_and_record"))
      return {
        data: [{ allowed: true, limit_value: 20, remaining: 19, reset_at: 1 }],
        error: null,
      };
    return {
      data: [
        { ...row, result: name.startsWith("update") ? "updated" : "created" },
      ],
      error: null,
    };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isolated Geobot integration", () => {
  it.each(['https://example.com/product?a=1&a=2#details', 'http://example.org/', 'https://münich.de/ação', 'https://wa.me/5511999999999?text=Oi'])("accepts global Geobot destination %s without changing Alcance", async (destinationUrl) => {
    const body = JSON.stringify({ destinationType: 'url', destinationUrl });
    const response = await POST(request('POST', 'geobot', body));
    expect(response.status).toBe(201);
    expect((await response.json()).data.destinationType).toBe('url');
    expect(mocks.rpc.mock.calls[1][0]).toBe('create_geobot_url_short_link');
    expect(mocks.rpc.mock.calls[1][1].p_destination_url).toBe(new URL(destinationUrl).toString());
    mocks.rpc.mockClear();
    expect((await POST(request('POST', 'alcance_ia', body))).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(['javascript:alert(1)', 'https://localhost', 'http://127.1', 'https://user:pass@example.com', 'https://encurta.io/ABCD'])("rejects invalid Geobot destination %s before quota", async (destinationUrl) => {
    expect((await POST(request('POST', 'geobot', JSON.stringify({ destinationType: 'url', destinationUrl })))).status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('returns the URL type on GET and PATCH', async () => {
    destinationType = 'url';
    expect((await (await GET(request('GET'), context())).json()).data.destinationType).toBe('url');
    expect((await (await PATCH(request('PATCH'), context())).json()).data.destinationType).toBe('url');
  });
  it('hashes the full URL, including its fragment and query', async () => {
    const hashes = [];
    for (const destinationUrl of ['https://example.com/?a=1#one', 'https://example.com/?a=2#one', 'https://example.com/?a=1#two']) {
      await POST(request('POST', 'geobot', JSON.stringify({ destinationType: 'url', destinationUrl })));
      hashes.push(mocks.rpc.mock.calls.at(-1)?.[1].p_payload_hash);
    }
    expect(new Set(hashes).size).toBe(3);
  });
  it("is disabled by default and accepts blank optional configuration", () => {
    vi.stubEnv("GEOBOT_INTEGRATION_ENABLED", undefined);
    vi.stubEnv("GEOBOT_API_KEY", "");
    vi.stubEnv("GEOBOT_HMAC_SECRET", "");
    vi.stubEnv("GEOBOT_ALLOWED_ORIGIN", "");
    expect(getGeobotEnvConfig()).toMatchObject({
      enabled: false,
      apiKey: null,
      hmacSecret: null,
      source: "geobot",
    });
  });
  it.each(["geobot", "alcance_ia"] as const)(
    "creates %s links using their own RPC, events and quota",
    async (source) => {
      const response = await POST(request("POST", source));
      expect(response.status).toBe(201);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.rpc.mock.calls[0][0]).toBe(
        source === "geobot"
          ? "check_and_record_geobot_rate_limit"
          : "check_and_record_integration_rate_limit_v2",
      );
      expect(mocks.rpc.mock.calls[0][1].p_source).toBe(source);
      expect(mocks.rpc.mock.calls[1][0]).toBe(
        source === "geobot"
          ? "create_geobot_whatsapp_short_link"
          : "create_internal_whatsapp_short_link",
      );
      expect(events[0].integration_source).toBe(source);
      expect((await response.json()).data.slug).toBe("GeoTest");
    },
  );
  it.each(["geobot", "alcance_ia"] as const)(
    "rejects another client's credentials for %s before accessing the DB",
    async (source) => {
      const response = await POST(
        request(
          "POST",
          source,
          undefined,
          source === "geobot" ? "alcance_ia" : "geobot",
        ),
      );
      expect(response.status).toBe(401);
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("keeps Alcance available when Geobot is disabled", async () => {
    vi.stubEnv("GEOBOT_INTEGRATION_ENABLED", "false");
    expect((await POST(request())).status).toBe(403);
    expect((await POST(request("POST", "alcance_ia"))).status).toBe(201);
  });
  it("honors independent database flags", async () => {
    flags["integrations.geobot.creation_enabled"] = false;
    expect((await POST(request())).status).toBe(403);
    expect((await POST(request("POST", "alcance_ia"))).status).toBe(201);
  });
  it("returns the same link on idempotent replay", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name.startsWith("check")
        ? [{ allowed: true, limit_value: 20, remaining: 19, reset_at: 1 }]
        : [{ ...row, result: "replay" }],
      error: null,
    }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).meta.idempotentReplay).toBe(true);
  });
  it("returns a safe conflict instead of creating a duplicate", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name.startsWith("check")
        ? [{ allowed: true, limit_value: 20, remaining: 19, reset_at: 1 }]
        : [{ result: "conflict" }],
      error: null,
    }));
    expect((await POST(request())).status).toBe(409);
  });
  it("returns 429 with retry guidance and does not create a link", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["geobot", "alcance_ia"] as const)(
    "blocks GET access to another client's link for %s",
    async (source) => {
      owner = source === "geobot" ? "alcance_ia" : "geobot";
      const response = await GET(request("GET", source), context());
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("GeoTest");
    },
  );
  it.each(["geobot", "alcance_ia"] as const)(
    "updates %s through its source-restricted RPC",
    async (source) => {
      expect((await PATCH(request("PATCH", source), context())).status).toBe(
        200,
      );
      expect(mocks.rpc.mock.calls[1][0]).toBe(
        source === "geobot"
          ? "update_geobot_link_slug"
          : "update_internal_link_slug",
      );
      expect(events[0].integration_source).toBe(source);
    },
  );
  it("rejects arbitrary URLs before accessing the database", async () => {
    const response = await POST(
      request(
        "POST",
        "geobot",
        '{"destinationType":"whatsapp","phone":"5571999999999","destinationUrl":"https://example.com"}',
      ),
    );
    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
