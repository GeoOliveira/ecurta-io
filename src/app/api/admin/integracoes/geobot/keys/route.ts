import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/server";
import { createGeobotApiKey, geobotApiKeyPrefix, hashIntegrationApiKey } from "@/lib/integrations/geobot-api-keys";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  const db = getServiceClient();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim() : "Geobot produção";
  if (!label || label.length > 80) return NextResponse.json({ error: "INVALID_LABEL" }, { status: 422 });
  const key = createGeobotApiKey();
  const { data, error } = await db.from("integration_api_keys").insert({
    integration_source: "geobot", label, key_prefix: `${geobotApiKeyPrefix}${key.slice(geobotApiKeyPrefix.length, geobotApiKeyPrefix.length + 8)}`,
    key_hash: hashIntegrationApiKey(key), created_by: session.userId,
  }).select("id,label,key_prefix,created_at").single();
  if (error) return NextResponse.json({ error: "KEY_CREATE_FAILED" }, { status: 500 });
  await db.from("audit_logs").insert({ actor_user_id: session.userId, action: "create_geobot_api_key", entity_type: "integration_api_key", entity_id: data.id, after_data: { integration_source: "geobot", label: data.label, key_prefix: data.key_prefix } });
  return NextResponse.json({ data: { ...data, key } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  const db = getServiceClient();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "INVALID_KEY" }, { status: 422 });
  const { data, error } = await db.from("integration_api_keys").update({ revoked_at: new Date().toISOString(), revoked_by: session.userId }).eq("id", id).eq("integration_source", "geobot").is("revoked_at", null).select("id,label,key_prefix").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "KEY_NOT_FOUND" }, { status: 404 });
  await db.from("audit_logs").insert({ actor_user_id: session.userId, action: "revoke_geobot_api_key", entity_type: "integration_api_key", entity_id: data.id, after_data: { integration_source: "geobot", label: data.label, key_prefix: data.key_prefix } });
  return new Response(null, { status: 204 });
}
