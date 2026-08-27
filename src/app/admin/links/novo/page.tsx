import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { getShortDomain } from "@/lib/config";
import { createShortLinkAction } from "../actions";
export default async function NewLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <main className="admin-main">
      <div className="admin-page-head">
        <div>
          <span className="breadcrumb">Início / Links / Novo</span>
          <h1>Novo link</h1>
          <p>Crie um redirecionamento autorizado para WhatsApp.</p>
        </div>
        <Link className="btn btn-secondary" href="/admin/links">
          <ArrowLeft size={16} /> Voltar
        </Link>
      </div>
      <div className="new-link-grid">
        <form
          className="settings-card create-form"
          action={createShortLinkAction}
        >
          <div className="settings-card-head">
            <div className="metric-icon">
              <MessageCircle />
            </div>
            <div>
              <h2>Destino do WhatsApp</h2>
              <p>A URL é construída e validada no servidor.</p>
            </div>
          </div>
          <label htmlFor="phone">
            Telefone <em>*</em>
          </label>
          <div className="phone-field">
            <input disabled value="+55" aria-label="Código do país" />
            <div className="input-icon">
              <Phone />
              <input
                id="phone"
                name="phone"
                placeholder="(71) 99999-9999"
                required
              />
            </div>
          </div>
          <label htmlFor="message">Mensagem opcional</label>
          <textarea
            id="message"
            name="message"
            maxLength={1000}
            rows={5}
            placeholder="Olá! Gostaria de saber mais sobre..."
          />
          <p className="field-help">
            A mensagem será codificada com segurança na URL.
          </p>
          <label htmlFor="expiresAt">Expiração opcional</label>
          <div className="input-icon">
            <CalendarClock />
            <input id="expiresAt" name="expiresAt" type="datetime-local" />
          </div>
          <label htmlFor="note">Observação interna</label>
          <textarea
            id="note"
            name="note"
            maxLength={500}
            rows={3}
            placeholder="Identificação visível somente no painel"
          />
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <button className="btn btn-block" type="submit">
            <Plus size={17} /> Criar link
          </button>
        </form>
        <aside className="preview-card">
          <span className="section-kicker">Pré-visualização</span>
          <h2>Seu novo link</h2>
          <div className="preview-url">
            <small>Link curto</small>
            <strong>
              {getShortDomain()}/<b>B7xK</b>
            </strong>
          </div>
          <ul>
            <li>
              <ShieldCheck /> Destino limitado a wa.me
            </li>
            <li>
              <ShieldCheck /> Slug aleatório de 4 caracteres
            </li>
            <li>
              <ShieldCheck /> Redirecionamento temporário 307
            </li>
          </ul>
          <p>O slug definitivo será criado ao salvar.</p>
        </aside>
      </div>
    </main>
  );
}
