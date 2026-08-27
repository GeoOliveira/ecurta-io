# Integração privada Geobot × Encurta.io

A Geobot utiliza a mesma API versionada do Alcance IA, com identidade e
credenciais independentes. Nenhuma chave do Alcance precisa ser alterada.

## Contrato

Base canônica: `https://www.encurta.io` (não enviar credenciais através de redirects).
Operações: `POST /api/internal/v1/links`, `GET /api/internal/v1/links/{id}` e
`PATCH /api/internal/v1/links/{id}`. JSON, HTTPS e `Cache-Control: no-store`.

Headers obrigatórios: `Authorization: Bearer <chave>`,
`X-Integration-Source: geobot`, `X-Request-Id` (8–100 caracteres),
`X-Timestamp` (ISO 8601 UTC) e `X-Signature: sha256=<hex>`.
A assinatura HMAC-SHA256 usa cinco linhas, sem newline final:
timestamp, método HTTP, pathname, request ID e SHA256 do corpo bruto.
No GET, o corpo assinado é a string vazia. Consulte o contrato completo em
`docs/integracao-alcance-ia-api-privada.md`; substitua somente a identidade e
as credenciais. Não substitua segredos do Alcance.

POST aceita dois formatos exclusivos:

- `destinationType: "whatsapp"`, telefone brasileiro em `phone` e mensagem
  opcional (até 1.000 caracteres): contrato anterior, preservado.
- `destinationType: "url"`, endereço público HTTP/HTTPS em `destinationUrl`
  (até 4.096 caracteres): encurtador global da Geobot. Preserva caminho,
  query string (inclusive parâmetros repetidos) e fragmento. Não enviar phone/message.

Ambos aceitam `slug` opcional (4–32 caracteres alfanuméricos, não reservado),
expiração opcional, IDs externos opcionais e metadata restrita.
O Alcance continua aceitando apenas o formato WhatsApp. Exemplo exclusivo da Geobot:

```json
{"destinationType": "url", "destinationUrl": "https://example.com/produto?utm_source=geobot#detalhes"}
```

Endereços com credenciais, protocolos não web, IPs locais/privados, hosts locais
e URLs do próprio encurta.io são recusados. Não há consulta DNS nem acesso ao
destino na criação: a validação é sintática e não substitui análise de reputação.
O mesmo request ID e payload retornam o mesmo link (200); alterações no payload
com esse ID retornam 409. Primeira criação retorna 201. PATCH altera apenas slug.

## Configuração

| Encurta.io / Vercel | Geobot / Render |
| --- | --- |
| GEOBOT_API_KEY | ENCURTA_API_KEY (mesmo valor) |
| GEOBOT_HMAC_SECRET | ENCURTA_HMAC_SECRET (mesmo valor) |
| GEOBOT_INTEGRATION_ENABLED=true | ENCURTA_INTEGRATION_ENABLED=true |
| — | ENCURTA_API_URL=https://www.encurta.io |
| — | ENCURTA_INTEGRATION_SOURCE=geobot |
| — | ENCURTA_HOURLY_LIMIT=100 |
| — | REDIS_URL_SESSIONS já usado pelo frontend |

Use valores criptograficamente aleatórios independentes para API key e HMAC.
Nunca use `NEXT_PUBLIC_`, nunca envie segredos pelo navegador e nunca os comite.
`GEOBOT_ALLOWED_ORIGIN` é opcional: o cliente server-to-server não envia Origin.
Se enviado, Origin deve coincidir exatamente com a configuração.

A migration `202608270001_geobot_integration.sql` acrescenta três RPCs privadas
e configurações `integrations.geobot.*`. Não substitui funções do Alcance.
As flags `integrations.geobot.enabled` e `.creation_enabled` começam falsas.
Para URLs globais, aplicar também `202608270002_geobot_global_urls.sql` antes
do deploy da API. Ela amplia os CHECKs, cria `create_geobot_url_short_link` e
`resolve_short_link_v2`, sem alterar funções, flags ou links existentes.
Publicar a API antes do frontend. Não reverter a migration após criar links URL;
para interromper novas criações, desativar a flag da Geobot.
Ative-as somente depois de instalar a migration e configurar o servidor:

```sql
update public.app_settings set value='true'::jsonb, updated_at=now()
where key in ('integrations.geobot.enabled','integrations.geobot.creation_enabled');
```

Limites iniciais por endpoint: 20/minuto, 100/hora e 1.000/dia, separados do
Alcance. O provedor conta tentativas autenticadas, inclusive replays; a quota
Redis da Geobot não conta novamente o mesmo ID dentro da janela. HTTP 429 inclui
orientação de nova tentativa. A interface pública não personaliza slugs ainda.

## Isolamento e implantação

O header escolhe a configuração, mas só autenticação Bearer + HMAC válida
autoriza o acesso. Fonte desconhecida não passa na autenticação.
GET compara o proprietário; PATCH verifica a fonte dentro da transação SQL.
As RPCs são executáveis apenas por `service_role`. A idempotência é única por
`(integration_source, request_id)` e os eventos registram a integração correta.

Ordem: backup → testes → `supabase db push --dry-run` → conferir a migration
única → aplicar → cadastrar segredos → publicar Encurta.io → ativar flags →
testar API → ativar cliente Geobot e publicar → testar página e redirect.
Para interromper a Geobot, desative sua flag no Render e/ou as flags no banco.
Não exclua links ou tabelas e não altere as configurações do Alcance.

## Testes

`npm test` executa testes de autenticação/rotas, mocks do serviço e PostgreSQL
real em memória via PGlite. Testa replay, conflito, limites, RLS/permissões de
funções e acesso cruzado entre integrações. Não conecta ao banco de produção.
Execute também `npm run lint`, `npm run typecheck` e `npm run build`.
O painel administrativo existente continua específico do Alcance; as flags da
Geobot são administradas pelo servidor e pelo SQL acima, não por aquele painel.
