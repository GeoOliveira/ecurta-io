import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  FileWarning,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { submitReportAction } from "./actions";
export const metadata: Metadata = {
  title: "Denunciar um link | Encurta.io",
  description:
    "Envie uma denúncia sobre fraude, spam, phishing ou outro uso inadequado de um link Encurta.io.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/denunciar" },
};
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string }>;
}) {
  const { erro, enviado } = await searchParams;
  return (
    <PublicShell>
      <section className="internal-hero report-hero">
        <div className="site-container">
          <span className="section-kicker">Proteção da comunidade</span>
          <h1>Denunciar um link</h1>
          <p>
            Envie uma denúncia caso tenha encontrado um link relacionado a
            fraude, spam, phishing ou outro uso inadequado.
          </p>
        </div>
      </section>
      <section className="report-section">
        <div className="site-container report-grid">
          <aside>
            <div className="report-assurance">
              <ShieldAlert size={28} />
              <h2>Análise responsável</h2>
              <p>
                As informações são avaliadas pela equipe e podem resultar em
                bloqueio preventivo quando necessário.
              </p>
            </div>
            <ol className="report-steps">
              <li>
                <span>1</span>Informe o link
              </li>
              <li>
                <span>2</span>Selecione o motivo
              </li>
              <li>
                <span>3</span>Descreva o problema
              </li>
              <li>
                <span>4</span>Envie para análise
              </li>
            </ol>
          </aside>
          {enviado ? (
            <div className="success-state">
              <CheckCircle2 size={52} />
              <h2>Denúncia recebida</h2>
              <p>
                A equipe analisará as informações e poderá bloquear o link
                preventivamente quando necessário.
              </p>
              <Link className="btn" href="/">
                Voltar para a Home
              </Link>
            </div>
          ) : (
            <form className="form-card" action={submitReportAction}>
              <div className="form-title">
                <FileWarning size={22} />
                <div>
                  <h2>Detalhes da denúncia</h2>
                  <p>Não envie senhas ou informações desnecessárias.</p>
                </div>
              </div>
              <div className="honeypot" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <label htmlFor="url">
                Link denunciado <em>*</em>
              </label>
              <input
                id="url"
                name="url"
                type="url"
                placeholder="https://encurta.io/B7xK"
                required
              />
              <label htmlFor="reason">
                Motivo <em>*</em>
              </label>
              <select id="reason" name="reason" required defaultValue="">
                <option value="" disabled>
                  Selecione um motivo
                </option>
                <option value="phishing">Phishing</option>
                <option value="fraude">Fraude</option>
                <option value="spam">Spam</option>
                <option value="malware">Malware</option>
                <option value="impersonacao">Impersonação</option>
                <option value="ilegal">Conteúdo ilegal</option>
                <option value="direitos">Violação de direitos</option>
                <option value="outro">Outro</option>
              </select>
              <label htmlFor="description">
                Descrição <em>*</em>
              </label>
              <textarea
                id="description"
                name="description"
                minLength={20}
                maxLength={2000}
                rows={5}
                placeholder="Explique o que aconteceu e por que o link deve ser analisado."
                required
              />
              <div className="form-row">
                <div>
                  <label htmlFor="name">
                    Nome <small>opcional</small>
                  </label>
                  <input id="name" name="name" maxLength={120} />
                </div>
                <div>
                  <label htmlFor="email">
                    E-mail <small>opcional</small>
                  </label>
                  <input id="email" name="email" type="email" />
                </div>
              </div>
              <label htmlFor="evidence">
                Evidências ou observações <small>opcional</small>
              </label>
              <textarea
                id="evidence"
                name="evidence"
                maxLength={1500}
                rows={3}
              />
              <label className="check-field">
                <input type="checkbox" name="goodFaith" required />
                <span>Confirmo que envio esta denúncia de boa-fé.</span>
              </label>
              <label className="check-field">
                <input type="checkbox" name="privacy" required />
                <span>
                  Li e aceito o tratamento descrito na{" "}
                  <Link href="/privacidade">Política de Privacidade</Link>.
                </span>
              </label>
              {erro && (
                <p className="form-error" role="alert">
                  {erro}
                </p>
              )}
              <button className="btn btn-block" type="submit">
                <Send size={17} /> Enviar denúncia
              </button>
              <p className="form-security">
                <Search size={15} /> Denúncias não são exibidas publicamente.
              </p>
            </form>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
