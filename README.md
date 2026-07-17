# Encurta.io

Serviço independente de links curtos para destinos de WhatsApp autorizados.

## Desenvolvimento

Copie `.env.example` para `.env.local`, configure o Supabase e execute `npm run dev`. Valide com `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

As migrations em `supabase/migrations` devem ser revisadas e aplicadas manualmente no projeto Supabase. Não há deploy, DNS ou migration remota automatizados.

Consulte `docs/` para arquitetura, segurança e configuração.
