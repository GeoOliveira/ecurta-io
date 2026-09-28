"use server";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/server";

export async function saveGeobotIntegrationSettingsAction(formData: FormData) {
  const session = await getAdminSession(), db = getServiceClient();
  if (!session || session.role !== "super_admin") redirect("/admin/integracoes/geobot?erro=Sem+permissão");
  if (!db) redirect("/admin/integracoes/geobot?erro=Banco+indisponível");
  const enabled = formData.get("enabled") === "on", creationEnabled = formData.get("creation") === "on";
  const settings = [{ key: "integrations.geobot.enabled", value: enabled }, { key: "integrations.geobot.creation_enabled", value: creationEnabled }];
  const { error } = await db.from("app_settings").upsert(settings, { onConflict: "key" });
  if (error) redirect("/admin/integracoes/geobot?erro=Não+foi+possível+salvar");
  await db.from("audit_logs").insert({ actor_user_id: session.userId, action: "update_geobot_integration", entity_type: "app_settings", after_data: { enabled, creation_enabled: creationEnabled } });
  redirect("/admin/integracoes/geobot?salvo=1");
}
