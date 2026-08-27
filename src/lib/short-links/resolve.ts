import { getServiceClient } from "@/lib/supabase/server";
import { validateDestinationUrl } from "./destination";
import { normalizePublicUrl } from "./public-url.mjs";
import { isValidSlug } from "./slug";

type Resolution =
  | { kind: "active"; id: string; slug: string; destinationUrl: string }
  | { kind: "not-found" | "expired" | "blocked" | "error" };

export async function resolveShortLink(slug: string): Promise<Resolution> {
  if (!isValidSlug(slug)) return { kind: "not-found" };
  const db = getServiceClient();
  if (!db) return { kind: "error" };
  const { data, error } = await db.rpc("resolve_short_link_v2", { p_slug: slug });
  if (error || !data?.[0])
    return error ? { kind: "error" } : { kind: "not-found" };
  const result = data[0];
  if (result.status === "deleted") return { kind: "not-found" };
  if (result.status === "blocked" || result.status === "disabled")
    return { kind: "blocked" };
  if (result.status === "expired" || (result.expires_at && new Date(result.expires_at) <= new Date()))
    return { kind: "expired" };
  if (result.status !== "active") return { kind: "error" };
  if (result.destination_type === "url") {
    if (result.integration_source !== "geobot") return { kind: "error" };
    try { normalizePublicUrl(result.destination_url); } catch { return { kind: "error" }; }
  } else if (result.destination_type !== "whatsapp" || !validateDestinationUrl(result.destination_url)) return { kind: "error" };
  return {
    kind: "active",
    id: result.id,
    slug: result.slug,
    destinationUrl: result.destination_url,
  };
}
