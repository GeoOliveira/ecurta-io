import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { validateDestinationUrl } from "./destination";
import {
  DEFAULT_SLUG_LENGTH,
  generateShortSlug,
  normalizeSlugLength,
} from "./slug";
import { generateWhatsAppDestination } from "@/lib/whatsapp";

export type PreparedWhatsAppLink = {
  destinationUrl: string;
  expiresAt: string | null;
};

export function prepareWhatsAppShortLink(input: {
  phone: string;
  message?: string;
  expiresAt?: string | null;
  maximumMessageLength?: number;
  maximumExpirationDays?: number;
}): PreparedWhatsAppLink {
  const message = input.message?.normalize("NFC").trim();
  const maxMessage = input.maximumMessageLength ?? 1000;
  if (message && message.length > maxMessage)
    throw new Error("INVALID_MESSAGE");
  if (
    message &&
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(message)
  )
    throw new Error("INVALID_MESSAGE");
  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const date = new Date(input.expiresAt);
    const maximum = new Date(
      Date.now() + (input.maximumExpirationDays ?? 3650) * 86400000,
    );
    if (Number.isNaN(date.getTime()) || date <= new Date() || date > maximum)
      throw new Error("INVALID_EXPIRATION");
    expiresAt = date.toISOString();
  }
  const destination = generateWhatsAppDestination({
    phone: input.phone,
    message: message || undefined,
  });
  if (!validateDestinationUrl(destination.destinationUrl))
    throw new Error("INVALID_DESTINATION");
  return { destinationUrl: destination.destinationUrl, expiresAt };
}

export async function createAdministrativeWhatsAppShortLink(input: {
  phone: string;
  message?: string;
  expiresAt?: string | null;
  note?: string | null;
  createdBy: string;
  slugLength?: number;
}) {
  const db = getServiceClient();
  if (!db) throw new Error("SERVICE_UNAVAILABLE");
  const prepared = prepareWhatsAppShortLink(input);
  const { data: setting, error: settingError } =
    input.slugLength === undefined
      ? await db
          .from("app_settings")
          .select("value")
          .eq("key", "shortener.slug_length")
          .maybeSingle()
      : { data: null, error: null };
  if (settingError) throw new Error("PERSISTENCE_ERROR");
  const slugLength = normalizeSlugLength(
    input.slugLength ?? setting?.value ?? DEFAULT_SLUG_LENGTH,
  );
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = generateShortSlug(slugLength);
    const { data, error } = await db
      .from("short_links")
      .insert({
        slug,
        destination_url: prepared.destinationUrl,
        created_by: input.createdBy,
        expires_at: prepared.expiresAt,
        metadata: { note: input.note || null },
        created_via: "admin",
      })
      .select("id,slug")
      .single();
    if (!error && data) return data;
    if (error?.code !== "23505") throw new Error("PERSISTENCE_ERROR");
  }
  throw new Error("SLUG_COLLISION");
}
