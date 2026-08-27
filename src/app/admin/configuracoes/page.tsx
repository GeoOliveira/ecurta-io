import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Globe2,
  LockKeyhole,
  Plug,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { getServiceClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth";
import { getShortDomain } from "@/lib/config";
import {
  getAlcanceIaEnvConfig,
  integrationSecretsConfigured,
} from "@/lib/integrations/alcance-ia/config";
import { saveSettingsAction } from "./actions";
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; salvo?: string }>;
}) {
  const params = await searchParams,
    session = await getAdminSession(),
    db = getServiceClient(),
    env = getAlcanceIaEnvConfig();
  const { data } = db
    ? await db.from("app_settings").select("key,value,updated_at")
    : { data: null };
  const values = new Map((data ?? []).map((item) => [item.key, item.value])),
    value = (key: string, fallback: unknown) =>
      values.has(key) ? values.get(key) : fallback,
    editable = session?.role === "super_admin";
  return (
    <main className="admin-main">
      <div className="admin-page-head">
        <div>
          <span className="breadcrumb">Início / Configurações</span>
          <h1>Configurações</h1>
          <p>Controle o funcionamento da plataforma sem expor segredos.</p>
        </div>
      </div>
      {params.salvo && (
        <div className="success-banner">
          <CheckCircle2 />
          <div>
            <strong>Configurações salvas</strong>
            <span>As alterações foram registradas na auditoria.</span>
          </div>
        </div>
      )}
      {params.erro && <p className="form-error">{params.erro}</p>}
      <div className="settings-layout">
        <aside className="settings-nav">
          <a href="#geral">
            <Settings /> Geral
          </a>
          <a href="#dominio">
            <Globe2 /> Domínio
          </a>
          <a href="#links">
            <SlidersHorizontal /> Links
          </a>
          <a href="#analytics">
            <BarChart3 /> Analytics
          </a>
          <a href="#manutencao">
            <Wrench /> Manutenção
          </a>
          <a href="#integracao">
            <Plug /> Alcance IA
          </a>
          <a href="#seguranca">
            <ShieldCheck /> Segurança
          </a>
        </aside>
        <form className="settings-content" action={saveSettingsAction}>
          <Card
            id="geral"
            icon={<Settings />}
            title="Geral"
            subtitle="Disponibilidade do serviço e criação administrativa."
          >
            <Switch
              name="enabled"
              title="Serviço habilitado"
              technical="shortener.enabled"
              checked={Boolean(value("shortener.enabled", true))}
              disabled={!editable}
            />
            <Switch
              name="creation"
              title="Criação de links"
              technical="shortener.creation_enabled"
              checked={Boolean(value("shortener.creation_enabled", true))}
              disabled={!editable}
            />
          </Card>
          <Card
            id="dominio"
            icon={<Globe2 />}
            title="Domínio"
            subtitle="Endereço público usado nos links."
          >
            <Field
              name="domain"
              title="Domínio principal"
              technical="shortener.domain"
              value={String(value("shortener.domain", getShortDomain()))}
              disabled={!editable}
            />
            <div className="impact-note">
              <AlertTriangle />
              <span>
                Alterações exigem configuração correspondente de DNS e Vercel.
              </span>
            </div>
          </Card>
          <Card
            id="links"
            icon={<SlidersHorizontal />}
            title="Links"
            subtitle="Padrões de slug e mensagem."
          >
            <div className="setting-grid">
              <Field
                name="slugLength"
                title="Tamanho do slug"
                technical="shortener.slug_length"
                value={String(value("shortener.slug_length", 4))}
                type="number"
                min={4}
                max={16}
                disabled={!editable}
              />
              <Field
                name="maxMessage"
                title="Limite da mensagem"
                technical="shortener.maximum_message_length"
                value={String(value("shortener.maximum_message_length", 1000))}
                type="number"
                min={100}
                max={2000}
                disabled={!editable}
              />
            </div>
          </Card>
          <Card
            id="analytics"
            icon={<BarChart3 />}
            title="Analytics"
            subtitle="Métricas agregadas e retenção."
          >
            <Switch
              name="analytics"
              title="Analytics habilitado"
              technical="shortener.analytics_enabled"
              checked={Boolean(value("shortener.analytics_enabled", true))}
              disabled={!editable}
            />
            <Field
              name="retention"
              title="Retenção de eventos"
              technical="shortener.click_retention_days"
              value={String(value("shortener.click_retention_days", 90))}
              type="number"
              min={1}
              max={365}
              disabled={!editable}
            />
          </Card>
          <Card
            id="manutencao"
            icon={<Wrench />}
            title="Manutenção"
            subtitle="Mensagem informativa do painel."
          >
            <label className="setting-field">
              <span>Mensagem de manutenção</span>
              <textarea
                name="maintenance"
                rows={3}
                maxLength={500}
                defaultValue={String(
                  value("shortener.maintenance_message", ""),
                )}
                disabled={!editable}
              />
            </label>
          </Card>
          <Card
            id="integracao"
            icon={<Plug />}
            title="Integração Alcance IA"
            subtitle="API privada entre servidores, desabilitada por padrão."
          >
            <div className="health-list">
              <Health label="Flag de ambiente" ok={env.enabled} />
              <Health
                label="API key e HMAC"
                ok={integrationSecretsConfigured(env)}
              />
              <Health
                label="Integração no banco"
                ok={Boolean(value("integrations.alcance_ia.enabled", false))}
              />
              <Health
                label="Criação pela API"
                ok={Boolean(
                  value("integrations.alcance_ia.creation_enabled", false),
                )}
              />
            </div>
            <Link
              className="btn btn-secondary"
              href="/admin/integracoes/alcance-ia"
            >
              <Plug /> Abrir controles e métricas
            </Link>
          </Card>
          <Card
            id="seguranca"
            icon={<LockKeyhole />}
            title="Segurança do ambiente"
            subtitle="Somente a presença das variáveis é exibida."
          >
            <div className="env-grid">
              <Env
                icon={<Database />}
                label="Supabase"
                ok={Boolean(process.env.SUPABASE_URL)}
              />
              <Env
                icon={<Globe2 />}
                label="Domínio"
                ok={Boolean(process.env.NEXT_PUBLIC_SHORT_DOMAIN)}
              />
              <Env
                icon={<LockKeyhole />}
                label="Hash de visitantes"
                ok={Boolean(process.env.CLICK_HASH_SECRET)}
              />
            </div>
          </Card>
          {editable ? (
            <div className="settings-save">
              <div>
                <strong>Revise antes de salvar</strong>
                <span>Alterações críticas são auditadas.</span>
              </div>
              <button className="btn">
                <Save /> Salvar configurações
              </button>
            </div>
          ) : (
            <div className="impact-note">
              <LockKeyhole />
              <span>Acesso somente para visualização.</span>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
function Card({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-card" id={id}>
      <div className="settings-card-head">
        <div className="metric-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Switch({
  name,
  title,
  technical,
  checked,
  disabled,
}: {
  name: string;
  title: string;
  technical: string;
  checked: boolean;
  disabled: boolean;
}) {
  return (
    <label className="setting-row">
      <div>
        <span>{title}</span>
        <small>{technical}</small>
      </div>
      <input
        className="switch"
        type="checkbox"
        name={name}
        defaultChecked={checked}
        disabled={disabled}
      />
    </label>
  );
}
function Field({
  name,
  title,
  technical,
  value,
  disabled,
  type = "text",
  min,
  max,
}: {
  name: string;
  title: string;
  technical: string;
  value: string;
  disabled: boolean;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="setting-field">
      <span>{title}</span>
      <small>{technical}</small>
      <input
        name={name}
        type={type}
        min={min}
        max={max}
        defaultValue={value}
        disabled={disabled}
        required
      />
    </label>
  );
}
function Env({
  icon,
  label,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
}) {
  return (
    <div>
      {icon}
      <span>{label}</span>
      <strong className={ok ? "ok-text" : "warn-text"}>
        {ok ? "Configurado" : "Não configurado"}
      </strong>
    </div>
  );
}
function Health({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span>
      <i className={ok ? "ok" : "warn"} />
      <b>{label}</b>
      <em>{ok ? "Configurado" : "Desativado ou pendente"}</em>
    </span>
  );
}
