"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/server";
import { getAllowedShortDomains, normalizeShortDomain } from "@/lib/config";

const schema = z.object({
  domain: z.url().refine((value) => value.startsWith("https://")),
  allowedDomains: z.string().min(1).max(4000),
  slugLength: z.coerce.number().int().min(4).max(16),
  retention: z.coerce.number().int().min(1).max(365),
  maxMessage: z.coerce.number().int().min(100).max(2000),
  maintenance: z.string().max(500),
  enabled: z.string().optional(),
  creation: z.string().optional(),
  analytics: z.string().optional(),
});

export async function saveSettingsAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session || session.role !== "super_admin")
    redirect(
      "/admin/configuracoes?erro=Somente+super_admin+pode+alterar+configurações",
    );
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect("/admin/configuracoes?erro=Revise+os+valores+informados");
  const allowedDomains = getAllowedShortDomains(
    parsed.data.allowedDomains.split(/[\n,]/).map((domain) => domain.trim()).filter(Boolean),
  );
  const primaryDomain = normalizeShortDomain(parsed.data.domain);
  if (!allowedDomains.length || !primaryDomain || !allowedDomains.includes(primaryDomain))
    redirect("/admin/configuracoes?erro=Informe+domínios+HTTPS+válidos+e+inclua+o+principal+na+lista");
  const db = getServiceClient();
  if (!db) redirect("/admin/configuracoes?erro=Banco+de+dados+indisponível");
  const settings = [
    { key: "shortener.enabled", value: Boolean(parsed.data.enabled) },
    { key: "shortener.domain", value: primaryDomain },
    { key: "shortener.allowed_domains", value: allowedDomains },
    { key: "shortener.slug_length", value: parsed.data.slugLength },
    {
      key: "shortener.analytics_enabled",
      value: Boolean(parsed.data.analytics),
    },
    { key: "shortener.creation_enabled", value: Boolean(parsed.data.creation) },
    { key: "shortener.click_retention_days", value: parsed.data.retention },
    { key: "shortener.maximum_message_length", value: parsed.data.maxMessage },
    { key: "shortener.maintenance_message", value: parsed.data.maintenance },
  ];
  const { error } = await db
    .from("app_settings")
    .upsert(settings, { onConflict: "key" });
  if (error)
    redirect(
      "/admin/configuracoes?erro=Não+foi+possível+salvar+as+configurações",
    );
  await db
    .from("audit_logs")
    .insert({
      actor_user_id: session.userId,
      action: "update_settings",
      entity_type: "app_settings",
      after_data: { keys: settings.map((item) => item.key) },
    });
  redirect("/admin/configuracoes?salvo=1");
}
