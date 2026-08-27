import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  CircleCheck,
  Clock3,
  Headphones,
  Link2,
  LockKeyhole,
  MessageCircle,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { getAdminSession } from "@/lib/auth";

const benefits = [
  {
    icon: Link2,
    title: "Links fáceis de compartilhar",
    text: "Endereços mais simples para mensagens, bios e materiais digitais.",
  },
  {
    icon: ShieldCheck,
    title: "Redirecionamento validado",
    text: "Cada destino passa por verificações antes de direcionar o visitante.",
  },
  {
    icon: LockKeyhole,
    title: "Controle centralizado",
    text: "Gerencie status, expiração e disponibilidade em um único painel.",
  },
  {
    icon: BarChart3,
    title: "Métricas úteis",
    text: "Acompanhe cliques e atividade recente sem promessas artificiais.",
  },
];
const steps = [
  {
    n: "01",
    title: "Cadastre o destino",
    text: "Informe o telefone e a mensagem que serão usados no WhatsApp.",
  },
  {
    n: "02",
    title: "Gere o endereço curto",
    text: "O sistema cria um código seguro e exclusivo.",
  },
  {
    n: "03",
    title: "Compartilhe",
    text: "Use o link em mensagens, redes sociais e páginas de contato.",
  },
  {
    n: "04",
    title: "Acompanhe",
    text: "Visualize acessos e gerencie o status pelo painel.",
  },
];

export default async function Home() {
  const session = await getAdminSession();
  return (
    <PublicShell>
      <section className="home-hero">
        <div className="site-container hero-grid">
          <div className="hero-copy">
            <span className="pill">
              <Sparkles size={14} /> Redirecionamentos autorizados
            </span>
            <h1>
              Links curtos,
              <br />
              <span>simples e confiáveis</span>
            </h1>
            <p>
              O Encurta.io transforma endereços longos em links fáceis de
              compartilhar, gerenciar e acompanhar com segurança.
            </p>
            <div className="hero-actions">
              <Link className="btn" href={session ? "/admin" : "/login"}>
                Acessar painel <ArrowRight size={17} />
              </Link>
              <a className="btn btn-secondary" href="#como-funciona">
                Saiba como funciona <ArrowDown size={17} />
              </a>
            </div>
            <div className="hero-note">
              <CircleCheck size={17} />
              <span>
                Disponível inicialmente para integrações e usuários autorizados.
              </span>
            </div>
          </div>
          <div
            className="link-demo"
            aria-label="Demonstração de transformação de link"
          >
            <div className="demo-top">
              <span>Demonstração</span>
              <span className="online">
                <i /> Link ativo
              </span>
            </div>
            <div className="url-card">
              <span>Link original</span>
              <p>https://wa.me/5571•••••••••</p>
            </div>
            <div className="transform">
              <span />
              <div>
                <ArrowDown size={18} />
              </div>
              <span />
            </div>
            <div className="url-card short">
              <span>Link curto</span>
              <p>
                encurta.io/<strong>B7xK</strong>
              </p>
              <button aria-label="Exemplo de copiar link">
                <Check size={16} /> Pronto
              </button>
            </div>
            <div className="demo-footer">
              <span>
                <ShieldCheck size={16} /> Destino validado
              </span>
              <span>
                <Clock3 size={16} /> Redirect 307
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="trust-strip">
        <div className="site-container">
          <span>
            <ShieldCheck size={18} /> Destinos permitidos
          </span>
          <span>
            <LockKeyhole size={18} /> Acesso administrativo
          </span>
          <span>
            <MousePointerClick size={18} /> Métricas agregadas
          </span>
          <span>
            <CircleCheck size={18} /> Controle de abuso
          </span>
        </div>
      </section>
      <section className="home-section" id="beneficios">
        <div className="site-container">
          <div className="section-heading">
            <span className="section-kicker">Benefícios</span>
            <h2>Por que usar o Encurta.io?</h2>
            <p>
              Uma base segura e direta para compartilhar links autorizados sem
              complicação.
            </p>
          </div>
          <div className="benefit-grid">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article className="feature-card" key={title}>
                <div className="icon-box">
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="home-section section-tinted" id="como-funciona">
        <div className="site-container">
          <div className="section-heading centered">
            <span className="section-kicker">Fluxo simples</span>
            <h2>Do cadastro ao compartilhamento</h2>
            <p>Quatro etapas claras, com validação em cada ponto importante.</p>
          </div>
          <div className="steps-grid">
            {steps.map((step) => (
              <article key={step.n}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="home-section" id="seguranca">
        <div className="site-container security-grid">
          <div>
            <span className="section-kicker">Segurança</span>
            <h2>Segurança desde a criação até o redirecionamento</h2>
            <p className="section-lead">
              O Encurta.io limita destinos, valida links no momento do acesso e
              permite resposta rápida a abuso.
            </p>
            <ul className="check-list">
              <li>
                <Check /> Destinos permitidos são validados
              </li>
              <li>
                <Check /> Links podem ser bloqueados ou expirados
              </li>
              <li>
                <Check /> Não há redirecionamento para URLs arbitrárias
              </li>
              <li>
                <Check /> Nenhuma senha do WhatsApp é solicitada
              </li>
            </ul>
          </div>
          <div className="security-panel">
            <div className="shield-orbit">
              <ShieldCheck size={46} />
            </div>
            <h3>Camadas de confiança</h3>
            <div>
              <span>Destino</span>
              <strong>
                <CircleCheck /> Validado
              </strong>
            </div>
            <div>
              <span>Protocolo</span>
              <strong>
                <CircleCheck /> HTTPS
              </strong>
            </div>
            <div>
              <span>Status</span>
              <strong>
                <CircleCheck /> Monitorado
              </strong>
            </div>
            <div>
              <span>Abuso</span>
              <strong>
                <CircleCheck /> Denunciável
              </strong>
            </div>
          </div>
        </div>
      </section>
      <section className="home-section section-tinted">
        <div className="site-container">
          <div className="section-heading">
            <span className="section-kicker">Casos de uso</span>
            <h2>Feito para conexões legítimas</h2>
          </div>
          <div className="use-grid">
            <article>
              <MessageCircle />
              <div>
                <h3>WhatsApp</h3>
                <p>Atendimento, orçamento e páginas de contato.</p>
                <span className="tag available">Disponível agora</span>
              </div>
            </article>
            <article>
              <Headphones />
              <div>
                <h3>Atendimento</h3>
                <p>Links simples para iniciar conversas autorizadas.</p>
                <span className="tag available">Disponível agora</span>
              </div>
            </article>
            <article>
              <BarChart3 />
              <div>
                <h3>Campanhas e e-mail</h3>
                <p>Gerenciamento ampliado de campanhas e canais.</p>
                <span className="tag planned">Planejado</span>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="final-cta">
        <div className="site-container">
          <div>
            <span className="section-kicker light">Painel autorizado</span>
            <h2>Gerencie seus links com mais simplicidade</h2>
            <p>
              Acesse o painel para criar, acompanhar e controlar os links
              autorizados no Encurta.io.
            </p>
          </div>
          <Link className="btn btn-white" href={session ? "/admin" : "/login"}>
            Entrar no painel <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
