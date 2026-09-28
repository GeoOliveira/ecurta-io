import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const geobotApiKeyPrefix = "gbo_";

export function createGeobotApiKey() {
  return `${geobotApiKeyPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashIntegrationApiKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function getBearerApiKey(header: string | null) {
  if (!header || header.includes(",")) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(header);
  return match?.[1] ?? null;
}
