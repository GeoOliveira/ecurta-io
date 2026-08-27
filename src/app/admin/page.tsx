import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileWarning,
  Gauge,
  Globe2,
  Link2,
  MousePointerClick,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { getServiceClient } from "@/lib/supabase/server";
import { getShortDomain } from "@/lib/config";
import {
  getSlugCapacity,
  getSlugExpansionThreshold,
  normalizeSlugLength,
  SLUG_EXPANSION_THRESHOLD_PERCENT,
} from "@/lib/short-links/slug";
function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
export default async function Admin() {
  const db = getServiceClient();
  const today = new Date();
  const start30 = new Date(today);
  start30.setDate(start30.getDate() - 29);
  const { data: slugSetting } = db
    ? await db
        .from("app_settings")
        .select("value")
        .eq("key", "shortener.slug_length")
        .maybeSingle()
    : { data: null };
  const slugLength = normalizeSlugLength(slugSetting?.value);
  const [
    linksResult,
    statsResult,
    reportsResult,
    topResult,
    auditResult,
    occupiedSlugsResult,
  ] = db
    ? await Promise.all([
        db
          .from("short_links")
          .select("id,status,created_at", { count: "exact" })
          .is("deleted_at", null),
        db
          .from("short_link_daily_stats")
          .select("date,clicks,bot_clicks")
          .gte("date", dayKey(start30))
          .order("date"),
        db
          .from("abuse_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        db
          .from("short_links")
          .select("id,slug,status,click_count,last_accessed_at,destination_url")
          .is("deleted_at", null)
          .order("click_count", { ascending: false })
          .limit(5),
        db
          .from("audit_logs")
          .select("id,action,entity_type,created_at")
          .order("created_at", { ascending: false })
          .limit(6),
        db
          .from("short_links")
          .select("id", { count: "exact", head: true })
          .like("slug", "_".repeat(slugLength)),
      ])
    : [
        { data: [], count: 0 },
        { data: [] },
        { count: 0 },
        { data: [] },
        { data: [] },
        { count: 0 },
      ];
  const links = linksResult.data ?? [],
    stats = statsResult.data ?? [],
    statusCount = (status: string) =>
      links.filter((link) => link.status === status).length;
  const statsMap = new Map(stats.map((row) => [row.date, row]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(start30);
    d.setDate(d.getDate() + i);
    return (
      statsMap.get(dayKey(d)) ?? { date: dayKey(d), clicks: 0, bot_clicks: 0 }
    );
  });
  const total30 = days.reduce((sum, row) => sum + row.clicks, 0),
    total7 = days.slice(-7).reduce((sum, row) => sum + row.clicks, 0),
    todayClicks = days.at(-1)?.clicks ?? 0,
    maxClicks = Math.max(...days.map((row) => row.clicks), 1);
  const slugCapacity = getSlugCapacity(slugLength);
  const expansionThreshold = getSlugExpansionThreshold(slugLength);
  const occupiedSlugs = BigInt(occupiedSlugsResult.count ?? 0);
  const availableSlugs = slugCapacity - occupiedSlugs;
  const capacityUsage =
    Number((occupiedSlugs * BigInt(10000)) / slugCapacity) / 100;
  const thresholdProgress = Math.min(
    Number((occupiedSlugs * BigInt(10000)) / expansionThreshold) / 100,
    100,
  );
  const shouldExpand = occupiedSlugs >= expansionThreshold;
  const cards = [
    {
      label: "Links totais",
      value: linksResult.count ?? 0,
      desc: "Todos os links não excluídos",
      icon: Link2,
    },
    {
      label: "Links ativos",
      value: statusCount("active"),
      desc: "Disponíveis para redirecionar",
      icon: CheckCircle2,
    },
    {
      label: "Links bloqueados",
      value: statusCount("blocked"),
      desc: "Interrompidos por segurança",
      icon: ShieldAlert,
    },
    {
      label: "Links expirados",
      value: statusCount("expired"),
      desc: "Fora do prazo configurado",
      icon: CalendarClock,
    },
    {
      label: "Cliques hoje",
      value: todayClicks,
      desc: "Acessos agregados no dia",
      icon: MousePointerClick,
    },
    {
      label: "Últimos 7 dias",
      value: total7,
      desc: "Total de acessos registrados",
      icon: Activity,
    },
    {
      label: "Últimos 30 dias",
      value: total30,
      desc: "Total de acessos registrados",
      icon: Clock3,
    },
    {
      label: "Denúncias pendentes",
      value: reportsResult.count ?? 0,
      desc: "Aguardando análise",
      icon: FileWarning,
    },
  ];
  return (
    <main className="admin-main">
      <div className="admin-page-head">
        <div>
          <span className="breadcrumb">Início / Dashboard</span>
          <h1>Visão geral</h1>
          <p>Acompanhe a operação do Encurta.io com dados reais.</p>
        </div>
        <Link className="btn" href="/admin/links/novo">
          <Plus size={17} /> Novo link
        </Link>
      </div>
      <section className="metric-grid">
        {cards.map(({ label, value, desc, icon: Icon }) => (
          <article className="metric-card" key={label}>
            <div className="metric-icon">
              <Icon size={20} />
            </div>
            <span>{label}</span>
            <strong>{value.toLocaleString("pt-BR")}</strong>
            <p>{desc}</p>
          </article>
        ))}
      </section>
      <section className="admin-card slug-capacity-card">
        <div className="slug-capacity-head">
          <div className="metric-icon">
            <Gauge size={20} />
          </div>
          <div>
            <span className="section-kicker">Capacidade dos links curtos</span>
            <h2>Espaço atual com {slugLength} caracteres</h2>
            <p>
              Letras maiúsculas, minúsculas e números: 62 possibilidades por
              posição.
            </p>
          </div>
          <span
            className={`status ${shouldExpand ? "status-expired" : "status-active"}`}
          >
            <i />{" "}
            {shouldExpand
              ? `Planejar ${slugLength + 1} caracteres`
              : "Capacidade saudável"}
          </span>
        </div>
        <div className="slug-capacity-grid">
          <div>
            <span>Combinações disponíveis</span>
            <strong>{slugCapacity.toLocaleString("pt-BR")}</strong>
          </div>
          <div>
            <span>Links de {slugLength} caracteres gerados</span>
            <strong>{occupiedSlugs.toLocaleString("pt-BR")}</strong>
          </div>
          <div>
            <span>Combinações ainda livres</span>
            <strong>{availableSlugs.toLocaleString("pt-BR")}</strong>
          </div>
          <div>
            <span>Uso da capacidade total</span>
            <strong>
              {capacityUsage.toLocaleString("pt-BR", {
                maximumFractionDigits: 4,
              })}
              %
            </strong>
          </div>
        </div>
        <div className="slug-capacity-progress">
          <div>
            <span>Progresso até o ponto de revisão</span>
            <strong>
              {thresholdProgress.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}
              %
            </strong>
          </div>
          <div
            className="slug-progress-track"
            role="progressbar"
            aria-valuenow={thresholdProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${thresholdProgress}%` }} />
          </div>
          <p>
            {shouldExpand
              ? `O limite preventivo foi atingido. Considere alterar agora para ${slugLength + 1} caracteres.`
              : `Considere aumentar para ${slugLength + 1} caracteres ao atingir ${expansionThreshold.toLocaleString("pt-BR")} links (${SLUG_EXPANSION_THRESHOLD_PERCENT}% da capacidade), antes que as colisões se tornem frequentes.`}
          </p>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="admin-card chart-card">
          <div className="card-head">
            <div>
              <h2>Cliques ao longo do tempo</h2>
              <p>Últimos 30 dias · total e bots identificados</p>
            </div>
            <span className="chart-total">{total30} acessos</span>
          </div>
          {total30 === 0 ? (
            <div className="empty-compact">
              <MousePointerClick size={27} />
              <strong>Sem cliques no período</strong>
              <span>
                Os acessos aparecerão aqui após o primeiro redirecionamento.
              </span>
            </div>
          ) : (
            <>
              <div
                className="bar-chart"
                role="img"
                aria-label={`Gráfico de cliques dos últimos 30 dias. Total: ${total30}.`}
              >
                {days.map((row, i) => (
                  <div
                    className="bar-column"
                    key={row.date}
                    title={`${new Date(`${row.date}T12:00`).toLocaleDateString("pt-BR")}: ${row.clicks} cliques`}
                  >
                    <i
                      style={{
                        height: `${Math.max((row.clicks / maxClicks) * 100, row.clicks ? 5 : 0)}%`,
                      }}
                    />
                    <span>
                      {i % 5 === 0
                        ? new Date(`${row.date}T12:00`).getDate()
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-blue" /> Cliques totais
                </span>
                <span>
                  <i className="legend-cyan" /> Bots:{" "}
                  {days.reduce((sum, row) => sum + row.bot_clicks, 0)}
                </span>
              </div>
            </>
          )}
        </section>
        <section className="admin-card status-chart">
          <div className="card-head">
            <div>
              <h2>Status dos links</h2>
              <p>Distribuição atual</p>
            </div>
          </div>
          {links.length === 0 ? (
            <div className="empty-compact">
              <Link2 size={27} />
              <strong>Nenhum link criado</strong>
              <span>Crie o primeiro link para visualizar a distribuição.</span>
            </div>
          ) : (
            <div className="status-bars">
              {[
                ["Ativos", statusCount("active"), "active"],
                ["Desativados", statusCount("disabled"), "disabled"],
                ["Bloqueados", statusCount("blocked"), "blocked"],
                ["Expirados", statusCount("expired"), "expired"],
              ].map(([label, value, status]) => (
                <div key={String(status)}>
                  <p>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </p>
                  <div>
                    <i
                      className={`bar-${status}`}
                      style={{
                        width: `${(Number(value) / links.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="admin-card top-links">
          <div className="card-head">
            <div>
              <h2>Links mais acessados</h2>
              <p>Ordenados por cliques totais</p>
            </div>
            <Link href="/admin/links">
              Ver links <ArrowRight size={15} />
            </Link>
          </div>
          {!topResult.data?.length ? (
            <div className="empty-compact">
              <Link2 size={27} />
              <strong>Nenhum link para mostrar</strong>
            </div>
          ) : (
            <div className="rank-list">
              {topResult.data.map((link, index) => (
                <div key={link.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>/{link.slug}</strong>
                    <small>{new URL(link.destination_url).hostname}/••••</small>
                  </div>
                  <b>{link.click_count} cliques</b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="admin-card activity-card">
          <div className="card-head">
            <div>
              <h2>Atividade recente</h2>
              <p>Últimas ações administrativas</p>
            </div>
          </div>
          {!auditResult.data?.length ? (
            <div className="empty-compact">
              <Activity size={27} />
              <strong>Sem atividade recente</strong>
            </div>
          ) : (
            <div className="activity-list">
              {auditResult.data.map((item) => (
                <div key={item.id}>
                  <i />
                  <div>
                    <strong>{item.action.replaceAll("_", " ")}</strong>
                    <span>
                      {item.entity_type} ·{" "}
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="admin-card health-card">
          <div className="card-head">
            <div>
              <h2>Saúde da plataforma</h2>
              <p>Configuração essencial</p>
            </div>
          </div>
          <div className="health-list">
            <span>
              <i className={db ? "ok" : "warn"} />
              <b>Banco de dados</b>
              <em>{db ? "Operacional" : "Não configurado"}</em>
            </span>
            <span>
              <i className="ok" />
              <b>Autenticação</b>
              <em>Operacional</em>
            </span>
            <span>
              <i
                className={process.env.NEXT_PUBLIC_SHORT_DOMAIN ? "ok" : "warn"}
              />
              <b>Domínio</b>
              <em>
                {process.env.NEXT_PUBLIC_SHORT_DOMAIN
                  ? "Configurado"
                  : "Não configurado"}
              </em>
            </span>
            <span>
              <i className={process.env.CLICK_HASH_SECRET ? "ok" : "warn"} />
              <b>Analytics</b>
              <em>
                {process.env.CLICK_HASH_SECRET ? "Operacional" : "Atenção"}
              </em>
            </span>
          </div>
        </section>
        <section className="admin-card quick-card">
          <div className="card-head">
            <div>
              <h2>Atalhos rápidos</h2>
              <p>Ações frequentes</p>
            </div>
          </div>
          <div className="quick-links">
            <Link href="/admin/links/novo">
              <Plus /> Criar link
            </Link>
            <Link href="/admin/links">
              <Link2 /> Visualizar links
            </Link>
            <Link href="/admin/configuracoes">
              <ShieldAlert /> Configurações
            </Link>
            <a href={getShortDomain()} target="_blank" rel="noreferrer">
              <Globe2 /> Abrir site público
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
