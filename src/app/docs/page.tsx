import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Braces,
  CheckCircle2,
  Clock3,
  Code2,
  Database,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { CopyButton } from "@/components/copy-button";
export const metadata: Metadata = {
  title: "Documentação da API privada | Encurta.io",
  description:
    "Documentação técnica interna das integrações Encurta.io, Alcance IA e Geobot.",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";
const signatureShape = [
  "timestamp",
  "HTTP_METHOD",
  "request_path",
  "request_id",
  "sha256(raw_body)",
].join("\n");
const requestExample = JSON.stringify(
  {
    destinationType: "whatsapp",
    phone: "5571999999999",
    slug: "MinhaCampanha",
    message: "Olá! Gostaria de mais informações.",
    expiresAt: null,
    externalUserId: "usr_01J...",
    externalResourceId: "whatsapp_link_generator",
    metadata: { accessLevel: "public" },
  },
  null,
  2,
);
const responseExample = JSON.stringify(
  {
    data: {
      id: "uuid",
      slug: "B7xK",
      shortUrl: "https://www.encurta.io/B7xK",
      destinationType: "whatsapp",
      status: "active",
      expiresAt: null,
      createdAt: "2026-07-17T20:00:00.000Z",
    },
    meta: { requestId: "req_...", idempotentReplay: false },
  },
  null,
  2,
);
const errorExample = JSON.stringify(
  {
    error: {
      code: "INVALID_SIGNATURE",
      message: "Não foi possível autenticar a integração.",
      retryable: false,
    },
    meta: { requestId: "req_..." },
  },
  null,
  2,
);
const clientExample = [
  'import { createHash, createHmac, randomUUID } from "node:crypto";',
  "",
  'const path = "/api/internal/v1/links";',
  "const body = JSON.stringify({",
  '  destinationType: "whatsapp",',
  '  phone: "5571999999999",',
  '  message: "Olá! Gostaria de mais informações."',
  "});",
  'const requestId = `req_${randomUUID().replaceAll("-", "")}`;',
  "const timestamp = new Date().toISOString();",
  'const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");',
  'const payload = [timestamp, "POST", path, requestId, bodyHash].join("\\n");',
  'const signature = `sha256=${createHmac("sha256", process.env.ENCURTA_HMAC_SECRET!).update(payload).digest("hex")}`;',
  "",
  "const response = await fetch(`${process.env.ENCURTA_API_URL}${path}`, {",
  '  method: "POST",',
  "  headers: {",
  '    "Content-Type": "application/json",',
  "    Authorization: `Bearer ${process.env.ENCURTA_API_KEY}`,",
  '    "X-Integration-Source": "alcance_ia",',
  '    "X-Request-Id": requestId,',
  '    "X-Timestamp": timestamp,',
  '    "X-Signature": signature',
  "  },",
  '  body, cache: "no-store",',
  "  signal: AbortSignal.timeout(10_000)",
  "});",
].join("\n");
const toc = [
  ["visao-geral", "Visão geral"],
  ["autenticacao", "Autenticação"],
  ["assinatura", "HMAC"],
  ["criar", "Criar link"],
  ["consultar", "Consultar"],
  ["idempotencia", "Idempotência"],
  ["erros", "Erros"],
  ["limites", "Limites"],
  ["cliente", "Cliente TypeScript"],
  ["operacao", "Operação segura"],
];
export default async function DocsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return (
    <main className="docs-page">
      <header className="docs-header">
        <div className="docs-container">
          <Link className="docs-brand" href="/admin">
            <span>
              <BookOpen size={19} />
            </span>
            <strong>Encurta.io</strong>
            <em>Docs</em>
          </Link>
          <div className="docs-header-actions">
            <span className="docs-private">
              <LockKeyhole size={14} /> Uso interno
            </span>
            <Link className="btn btn-sm btn-secondary" href="/admin">
              <ArrowLeft size={15} /> Painel
            </Link>
          </div>
        </div>
      </header>
      <section className="docs-hero">
        <div className="docs-container">
          <div>
            <span className="pill">
              <Server size={14} /> API privada · v1
            </span>
            <h1>
              Integração técnica
              <br />
              <span>Encurta.io × Alcance IA e Geobot</span>
            </h1>
            <p>
              Contrato oficial para criação segura e idempotente de links curtos
              do WhatsApp entre backends autorizados.
            </p>
            <div className="docs-badges">
              <span>
                <CheckCircle2 /> Produção ativa
              </span>
              <span>
                <ShieldCheck /> Bearer + HMAC
              </span>
              <span>
                <Database /> Persistência transacional
              </span>
            </div>
          </div>
          <aside className="docs-endpoint-card">
            <span>Base URL</span>
            <code>https://www.encurta.io</code>
            <hr />
            <EndpointLine method="POST" path="/api/internal/v1/links" />
            <EndpointLine method="GET" path="/api/internal/v1/links/{id}" />
            <EndpointLine method="PATCH" path="/api/internal/v1/links/{id}" />
            <small>
              <LockKeyhole /> Exclusivamente server-to-server
            </small>
          </aside>
        </div>
      </section>
      <div className="docs-container docs-layout">
        <aside className="docs-toc">
          <strong>Nesta documentação</strong>
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
          <div>
            <ShieldCheck />
            <span>Nunca utilize credenciais reais em exemplos.</span>
          </div>
        </aside>
        <article className="docs-content">
          <Section id="visao-geral" number="01" title="Visão geral">
            <p>
              Alcance IA e Geobot validam a solicitação nos próprios backends. O Encurta.io
              autentica novamente, valida o telefone, gera internamente o
              destino <code>wa.me</code>, valida ou gera um slug seguro e persiste
              tudo em uma transação.
            </p>
            <div className="docs-flow">
              <Flow
                icon={<Webhook />}
                title="Alcance IA / Geobot"
                text="Prepara e assina"
              />
              <i>→</i>
              <Flow
                icon={<ShieldCheck />}
                title="Encurta.io"
                text="Autentica e valida"
              />
              <i>→</i>
              <Flow
                icon={<Database />}
                title="Supabase"
                text="Reserva e persiste"
              />
            </div>
            <Callout warning title="A API não é pública">
              Não aceite destino pronto nem chamadas do navegador. Slugs
              personalizados passam pelas mesmas validações de formato, reserva
              e unicidade. As credenciais existem somente nos backends.
            </Callout>
          </Section>
          <Section id="autenticacao" number="02" title="Autenticação">
            <p>
              Cada chamada exige todas as camadas abaixo. API key, HMAC e
              timestamp são verificados antes do processamento.
            </p>
            <div className="docs-table">
              <HeaderRow name="Authorization" value="Bearer {API_KEY}" />
              <HeaderRow name="X-Integration-Source" value="alcance_ia ou geobot (credenciais independentes)" />
              <HeaderRow
                name="X-Request-Id"
                value="Identificador único de 8–100 caracteres"
              />
              <HeaderRow
                name="X-Timestamp"
                value="Data ISO 8601 dentro da tolerância"
              />
              <HeaderRow name="X-Signature" value="sha256={HMAC_HEX}" />
              <HeaderRow
                name="Content-Type"
                value="application/json · POST e PATCH"
              />
            </div>
            <Callout title="Mapeamento dos segredos">
              Encurta.io usa <code>ALCANCE_IA_API_KEY</code> e{" "}
              <code>ALCANCE_IA_HMAC_SECRET</code>. Alcance IA usa os valores
              equivalentes em <code>ENCURTA_API_KEY</code> e{" "}
              <code>ENCURTA_HMAC_SECRET</code>.
            </Callout>
          </Section>
          <Callout title="Credenciais exclusivas da Geobot">
            Para a fonte <code>geobot</code>, configure <code>GEOBOT_API_KEY</code>
            {" "}e <code>GEOBOT_HMAC_SECRET</code> no Encurta.io. O frontend Geobot
            usa os mesmos valores em <code>ENCURTA_API_KEY</code> e
            {" "}<code>ENCURTA_HMAC_SECRET</code>, somente no servidor.
            Não reutilize as credenciais do Alcance. Links, limites e request IDs
            são separados por integração; nenhuma pode consultar ou alterar os
            links da outra. Os exemplos abaixo usam Alcance; para a Geobot,
            substitua a fonte e use suas próprias credenciais.
          </Callout>
          <Section id="assinatura" number="03" title="Assinatura HMAC-SHA256">
            <p>
              Assine o corpo bruto exatamente como será enviado. O conteúdo
              canônico usa cinco linhas:
            </p>
            <CodeBlock value={signatureShape} />
            <ul className="docs-checklist">
              <li>
                <CheckCircle2 /> Timestamp em UTC e ISO 8601.
              </li>
              <li>
                <CheckCircle2 /> Método em maiúsculas.
              </li>
              <li>
                <CheckCircle2 /> Path sem domínio ou query string.
              </li>
              <li>
                <CheckCircle2 /> Para GET, use corpo vazio.
              </li>
              <li>
                <CheckCircle2 /> Header final: <code>sha256=hexadecimal</code>.
              </li>
            </ul>
          </Section>
          <Section id="criar" number="04" title="Criar link">
            <Endpoint
              method="POST"
              path="/api/internal/v1/links"
              status="201 Created · 200 no replay"
            />
            <h3>Request</h3>
            <CodeBlock value={requestExample} />
            <h3>Response sanitizada</h3>
            <CodeBlock value={responseExample} />
            <p>
              A resposta não inclui telefone, mensagem, destino completo do
              WhatsApp, IP, metadata interna ou hashes.
            </p>
          </Section>
          <Section id="consultar" number="05" title="Consultar link">
            <Endpoint
              method="GET"
              path="/api/internal/v1/links/{id}"
              status="200 OK"
            />
            <p>
              Use somente o UUID retornado na criação. A integração não consegue
              consultar links administrativos ou de outras origens.
            </p>
            <div className="docs-response-list">
              <span>
                <b>Retorna</b> ID, slug, short URL, status, expiração, criação,
                último acesso e contagem.
              </span>
              <span>
                <b>Não retorna</b> destino, telefone, mensagem, eventos
                individuais ou dados pessoais.
              </span>
            </div>
            <h3>Alterar slug</h3>
            <Endpoint
              method="PATCH"
              path="/api/internal/v1/links/{id}"
              status="200 OK"
            />
            <CodeBlock value={'{\n  "slug": "MinhaCampanha"\n}'} />
            <p>
              A resposta usa o registro persistido. Slug ocupado retorna
              <code>409 SLUG_UNAVAILABLE</code>; slug inválido ou reservado
              retorna <code>422 VALIDATION_ERROR</code>.
            </p>
          </Section>
          <Section id="idempotencia" number="06" title="Idempotência e replay">
            <p>
              O <code>X-Request-Id</code> representa uma operação lógica e é
              reservado na mesma transação da criação.
            </p>
            <div className="docs-cards">
              <Card
                icon={<CheckCircle2 />}
                title="Primeira chamada"
                text="Cria o link e retorna 201."
              />
              <Card
                icon={<RefreshCw />}
                title="Mesmo ID e payload"
                text="Retorna o link original com 200."
              />
              <Card
                icon={<AlertTriangle />}
                title="Mesmo ID, outro payload"
                text="Retorna 409 IDEMPOTENCY_CONFLICT."
              />
            </div>
            <Callout title="Política de retry">
              Repita somente após timeout, indisponibilidade ou 5xx, usando o
              mesmo request ID e o mesmo corpo.
            </Callout>
          </Section>
          <Section id="erros" number="07" title="Erros e retries">
            <div className="docs-errors">
              <ErrorRow status="400" code="INVALID_REQUEST_ID" retry="Não" />
              <ErrorRow
                status="401"
                code="UNAUTHORIZED / INVALID_SIGNATURE"
                retry="Não"
              />
              <ErrorRow
                status="401"
                code="REQUEST_EXPIRED"
                retry="Novo timestamp"
              />
              <ErrorRow
                status="403"
                code="INTEGRATION_DISABLED / CREATION_DISABLED"
                retry="Não"
              />
              <ErrorRow status="409" code="IDEMPOTENCY_CONFLICT" retry="Não" />
              <ErrorRow status="413" code="PAYLOAD_TOO_LARGE" retry="Não" />
              <ErrorRow
                status="422"
                code="VALIDATION_ERROR / INVALID_PHONE"
                retry="Não"
              />
              <ErrorRow
                status="429"
                code="RATE_LIMIT_EXCEEDED"
                retry="Após Retry-After"
              />
              <ErrorRow
                status="503"
                code="SERVICE_UNAVAILABLE"
                retry="Mesmo request ID"
              />
            </div>
            <CodeBlock value={errorExample} />
          </Section>
          <Section id="limites" number="08" title="Limites e proteção">
            <div className="docs-limits">
              <Limit icon={<Clock3 />} title="Por minuto" value="20" />
              <Limit icon={<Clock3 />} title="Por hora" value="200" />
              <Limit icon={<Clock3 />} title="Por dia" value="1.000" />
              <Limit icon={<Braces />} title="Body" value="8 KB" />
            </div>
            <p>
              Os limites são distribuídos e transacionais. Quando aplicável, a
              resposta inclui <code>X-RateLimit-Limit</code>,{" "}
              <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>{" "}
              e <code>Retry-After</code>.
            </p>
          </Section>
          <Section id="cliente" number="09" title="Cliente TypeScript">
            <p>
              Exemplo para Route Handler ou serviço exclusivamente server-side
              da Alcance IA.
            </p>
            <CodeBlock value={clientExample} />
          </Section>
          <Section id="operacao" number="10" title="Operação segura">
            <div className="docs-cards">
              <Card
                icon={<KeyRound />}
                title="Credenciais"
                text="Diferentes por ambiente e somente no servidor."
              />
              <Card
                icon={<Code2 />}
                title="Observabilidade"
                text="Registre request ID, status e latência; nunca o corpo."
              />
              <Card
                icon={<LockKeyhole />}
                title="Desativação"
                text="Use Vercel ou os controles administrativos."
              />
            </div>
            <h3>Checklist operacional</h3>
            <ul className="docs-checklist">
              <li>
                <CheckCircle2 /> Confirmar ambiente e domínio.
              </li>
              <li>
                <CheckCircle2 /> Verificar que API key e HMAC coincidem nos dois
                backends.
              </li>
              <li>
                <CheckCircle2 /> Testar criação, replay e consulta com request
                ID controlado.
              </li>
              <li>
                <CheckCircle2 /> Conferir{" "}
                <Link href="/admin/integracoes/alcance-ia">
                  auditoria e métricas <ExternalLink size={13} />
                </Link>
                .
              </li>
              <li>
                <CheckCircle2 /> Manter segredos fora de logs, tickets e
                capturas.
              </li>
            </ul>
          </Section>
        </article>
      </div>
    </main>
  );
}
function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="docs-section" id={id}>
      <span className="docs-number">{number}</span>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function CodeBlock({ value }: { value: string }) {
  return (
    <div className="docs-code">
      <div>
        <span />
        <span />
        <span />
        <small>Exemplo sem credenciais reais</small>
        <CopyButton value={value} />
      </div>
      <pre>
        <code>{value}</code>
      </pre>
    </div>
  );
}
function Callout({
  title,
  children,
  warning = false,
}: {
  title: string;
  children: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`docs-callout ${warning ? "warning" : ""}`}>
      <div>{warning ? <AlertTriangle /> : <ShieldCheck />}</div>
      <p>
        <strong>{title}</strong>
        <span>{children}</span>
      </p>
    </div>
  );
}
function Flow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
function HeaderRow({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <code>{name}</code>
      <span>{value}</span>
      <b>Obrigatório</b>
    </div>
  );
}
function EndpointLine({ method, path }: { method: string; path: string }) {
  return (
    <div>
      <b className={method === "GET" ? "get" : ""}>{method}</b>
      <code>{path}</code>
    </div>
  );
}
function Endpoint({
  method,
  path,
  status,
}: {
  method: string;
  path: string;
  status: string;
}) {
  return (
    <div className="docs-endpoint">
      <b className={method === "GET" ? "get" : ""}>{method}</b>
      <code>{path}</code>
      <span>{status}</span>
    </div>
  );
}
function Card({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      {icon}
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
function ErrorRow({
  status,
  code,
  retry,
}: {
  status: string;
  code: string;
  retry: string;
}) {
  return (
    <div>
      <b>{status}</b>
      <code>{code}</code>
      <span>{retry}</span>
    </div>
  );
}
function Limit({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div>
      {icon}
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
