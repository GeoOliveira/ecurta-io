# Encurta.io

Serviço independente de links curtos para destinos de WhatsApp autorizados.

## Desenvolvimento

Copie `.env.example` para `.env.local`, configure o Supabase e execute `npm run dev`. Valide com `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

As migrations em `supabase/migrations` devem ser revisadas e aplicadas manualmente. Não há deploy, DNS ou migration remota automatizados.

## API privada Alcance IA

A integração server-to-server está versionada em `/api/internal/v1`, exige Bearer token, HMAC, timestamp e request ID, e inicia desabilitada. Consulte `docs/integracao-alcance-ia-api-privada.md`. A migration `202607170003_private_alcance_ia_api.sql` deve ser aplicada manualmente antes de testes em Preview.

## API privada Geobot

A fonte `geobot` possui credenciais, limites, idempotência e propriedade de links separados do Alcance IA. Consulte [integração Geobot](docs/integracao-geobot.md). A migration `202608270001_geobot_integration.sql` é aditiva e começa desativada. `npm test` inclui testes de isolamento em PostgreSQL local (PGlite), sem acesso à produção.
