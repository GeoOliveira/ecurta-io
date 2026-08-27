import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Link2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { Brand } from "@/components/public-shell";
import { LoginForm } from "@/components/login-form";
export const metadata: Metadata = {
  title: "Acessar painel | Encurta.io",
  description: "Acesso administrativo protegido ao painel Encurta.io.",
  robots: { index: false, follow: false },
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (await getAdminSession()) redirect("/admin");
  const { erro } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-visual">
        <div>
          <Brand />
          <div className="login-message">
            <span className="pill pill-light">
              <LockKeyhole size={14} /> Área administrativa
            </span>
            <h1>
              Links sob controle.
              <br />
              Dados ao seu alcance.
            </h1>
            <p>
              Gerencie links, acompanhe acessos e controle configurações da
              plataforma.
            </p>
            <ul>
              <li>
                <ShieldCheck /> Acesso protegido
              </li>
              <li>
                <CheckCircle2 /> Autenticação pelo Supabase
              </li>
              <li>
                <Activity /> Atividade administrativa auditada
              </li>
            </ul>
          </div>
          <div className="login-abstract">
            <div>
              <Link2 />
              <span>encurta.io/B7xK</span>
              <b>Ativo</b>
            </div>
            <div className="mini-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </section>
      <section className="login-side">
        <div className="login-card">
          <Link className="back-link" href="/">
            <ArrowLeft size={15} /> Voltar para a Home
          </Link>
          <div className="login-mobile-brand">
            <Brand />
          </div>
          <span className="section-kicker">Bem-vindo de volta</span>
          <h2>Acesse o painel do Encurta.io</h2>
          <p>Use as credenciais cadastradas pela administração.</p>
          <LoginForm error={erro} />
          <p className="login-help">
            Problemas para entrar? Entre em contato com o administrador
            responsável.
          </p>
        </div>
      </section>
    </main>
  );
}
