import "server-only";
import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { getShortDomain } from "@/lib/config";
import {
  DEFAULT_SLUG_LENGTH,
  generateShortSlug,
  normalizeSlugLength,
} from "@/lib/short-links/slug";
import { prepareWhatsAppShortLink } from "@/lib/short-links/service";
import { normalizeBrazilianPhone } from "@/lib/whatsapp";
import { InternalApiError } from "./errors";
import type {
  CreateInternalLinkInput,
  UpdateInternalLinkInput,
} from "./schemas";
import type { InternalLinkData } from "./types";
type SettingMap = Map<string, unknown>;
const value = <T>(settings: SettingMap, key: string, fallback: T) =>
  settings.has(key) ? (settings.get(key) as T) : fallback;
function stablePayloadHash(input: CreateInternalLinkInput) {
  const canonical = {
    destinationType: input.destinationType,
    phone: normalizeBrazilianPhone(input.phone),
    slug: input.slug ?? null,
    message: input.message?.normalize("NFC").trim() || null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    externalUserId: input.externalUserId ?? null,
    externalResourceId: input.externalResourceId ?? null,
    metadata: input.metadata ?? {},
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
function toData(row: Record<string, unknown>): InternalLinkData {
  return {
    id: String(row.link_id ?? row.id),
    slug: String(row.slug),
    shortUrl: `${getShortDomain()}/${row.slug}`,
    destinationType: "whatsapp",
    status: String(row.link_status ?? row.status),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at),
    ...(Object.hasOwn(row, "last_accessed_at")
      ? {
          lastAccessedAt: row.last_accessed_at
            ? String(row.last_accessed_at)
            : null,
          clickCount: Number(row.click_count ?? 0),
        }
      : {}),
  };
}
export async function getIntegrationSettings() {
  const db = getServiceClient();
  if (!db) throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
  const { data, error } = await db.from("app_settings").select("key,value");
  if (error) throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
  return {
    db,
    settings: new Map((data ?? []).map((row) => [row.key, row.value])),
  };
}
export async function createInternalLink(
  input: CreateInternalLinkInput,
  requestId: string,
) {
  const { db, settings } = await getIntegrationSettings();
  if (!value(settings, "integrations.alcance_ia.enabled", false))
    throw new InternalApiError("INTEGRATION_DISABLED", 403);
  if (!value(settings, "integrations.alcance_ia.creation_enabled", false))
    throw new InternalApiError("CREATION_DISABLED", 403);
  if (input.externalRequestId && input.externalRequestId !== requestId)
    throw new InternalApiError("IDEMPOTENCY_CONFLICT", 409);
  let prepared;
  try {
    prepared = prepareWhatsAppShortLink({
      phone: input.phone,
      message: input.message,
      expiresAt: input.expiresAt,
      maximumMessageLength: Number(
        value(settings, "integrations.alcance_ia.maximum_message_length", 1000),
      ),
      maximumExpirationDays: Number(
        value(
          settings,
          "integrations.alcance_ia.maximum_expiration_days",
          3650,
        ),
      ),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_EXPIRATION")
      throw new InternalApiError("INVALID_EXPIRATION", 422);
    if (error instanceof Error && error.message === "INVALID_MESSAGE")
      throw new InternalApiError("VALIDATION_ERROR", 422);
    throw new InternalApiError("INVALID_PHONE", 422);
  }
  const hash = stablePayloadHash(input);
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug =
      input.slug ??
      generateShortSlug(
        normalizeSlugLength(
          value(settings, "shortener.slug_length", DEFAULT_SLUG_LENGTH),
        ),
      );
    const { data, error } = await db.rpc(
      "create_internal_whatsapp_short_link",
      {
        p_request_id: requestId,
        p_payload_hash: hash,
        p_slug: slug,
        p_destination_url: prepared.destinationUrl,
        p_expires_at: prepared.expiresAt,
        p_external_user_id: input.externalUserId ?? null,
        p_external_resource_id: input.externalResourceId ?? null,
        p_metadata: input.metadata ?? {},
      },
    );
    if (error?.code === "23505") {
      if (input.slug) throw new InternalApiError("SLUG_UNAVAILABLE", 409);
      if (error.message?.includes("short_links_slug_key")) continue;
    }
    if (error) throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
    const row = (data as Record<string, unknown>[] | null)?.[0];
    if (!row) throw new InternalApiError("INTERNAL_ERROR", 500, true);
    if (row.result === "conflict")
      throw new InternalApiError("IDEMPOTENCY_CONFLICT", 409);
    if (row.result === "processing")
      throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
    return { data: toData(row), replay: row.result === "replay", db };
  }
  throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
}
export async function getInternalLink(id: string) {
  const { db, settings } = await getIntegrationSettings();
  if (!value(settings, "integrations.alcance_ia.enabled", false))
    throw new InternalApiError("INTEGRATION_DISABLED", 403);
  const { data, error } = await db
    .from("short_links")
    .select(
      "id,slug,status,expires_at,created_at,last_accessed_at,click_count,integration_source",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
  if (!data) throw new InternalApiError("LINK_NOT_FOUND", 404);
  if (data.integration_source !== "alcance_ia")
    throw new InternalApiError("INTEGRATION_LINK_ACCESS_DENIED", 403);
  return { data: toData(data), db };
}

export async function updateInternalLink(
  id: string,
  input: UpdateInternalLinkInput,
  requestId: string,
) {
  const { db, settings } = await getIntegrationSettings();
  if (!value(settings, "integrations.alcance_ia.enabled", false))
    throw new InternalApiError("INTEGRATION_DISABLED", 403);
  if (!value(settings, "integrations.alcance_ia.creation_enabled", false))
    throw new InternalApiError("CREATION_DISABLED", 403);

  const { data, error } = await db.rpc("update_internal_link_slug", {
    p_link_id: id,
    p_slug: input.slug,
    p_request_id: requestId,
  });
  if (error?.code === "23505")
    throw new InternalApiError("SLUG_UNAVAILABLE", 409);
  if (error) throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) throw new InternalApiError("INTERNAL_ERROR", 500, true);
  if (row.result === "not_found")
    throw new InternalApiError("LINK_NOT_FOUND", 404);
  if (row.result === "denied")
    throw new InternalApiError("INTEGRATION_LINK_ACCESS_DENIED", 403);
  return { data: toData(row), changed: row.result === "updated", db };
}
