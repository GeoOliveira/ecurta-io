import "server-only";
import { z } from "zod";
import { getAlcanceIaEnvConfig } from "./alcance-ia/config";

export type IntegrationSource = "alcance_ia" | "geobot";

const integer = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).catch(fallback);
const optional = (schema: z.ZodType) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );
const geobotSchema = z.object({
  GEOBOT_INTEGRATION_ENABLED: z.enum(["true", "false"]).catch("false"),
  GEOBOT_API_KEY: optional(z.string().min(24)),
  GEOBOT_ALLOWED_ORIGIN: optional(z.url()),
  GEOBOT_REQUEST_TIMEOUT_MS: integer(10000, 1000, 30000),
  GEOBOT_MINUTE_LINK_LIMIT: integer(20, 1, 10000),
  GEOBOT_HOURLY_LINK_LIMIT: integer(100, 1, 100000),
  GEOBOT_DAILY_LINK_LIMIT: integer(1000, 1, 1000000),
  GEOBOT_REQUEST_BODY_MAX_BYTES: integer(8192, 1024, 65536),
});

export function getGeobotEnvConfig() {
  const value = geobotSchema.parse(process.env);
  return {
    enabled: value.GEOBOT_INTEGRATION_ENABLED === "true",
    apiKey: (value.GEOBOT_API_KEY as string | undefined) ?? null,
    source: "geobot",
    authMode: "bearer" as const,
    allowedOrigin: (value.GEOBOT_ALLOWED_ORIGIN as string | undefined) ?? null,
    timeoutMs: value.GEOBOT_REQUEST_TIMEOUT_MS,
    minuteLimit: value.GEOBOT_MINUTE_LINK_LIMIT,
    hourlyLimit: value.GEOBOT_HOURLY_LINK_LIMIT,
    dailyLimit: value.GEOBOT_DAILY_LINK_LIMIT,
    maxBodyBytes: value.GEOBOT_REQUEST_BODY_MAX_BYTES,
  };
}

// The header only selects a credential set. Authentication always validates the
// source and bearer token; each integration may add its own auth mechanism.
export function getRequestIntegrationConfig(request: Request) {
  if (request.headers.get("x-integration-source") === "geobot") {
    return { ...getGeobotEnvConfig(), integration: "geobot" as const };
  }
  return { ...getAlcanceIaEnvConfig(), integration: "alcance_ia" as const };
}
