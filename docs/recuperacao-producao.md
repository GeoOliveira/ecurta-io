# Recuperação do código de produção — 27/08/2026

## Origem

- Projeto: `GeoOliveira/ecurta-io`.
- Base no GitHub: `d73008de7e1cdc69982324aa72a6b44e97b0147a`, de 17/07/2026.
- Deploy recuperado: `dpl_8uNxScBLjr8UUzCYNqTCdHhMVBxc`, de 21/07/2026.
- Esse deploy foi enviado por `vercel deploy`, não por um commit do GitHub.
- Fonte: https://vercel.com/georlandiooliveiragmailcoms-projects/ecurta-io/8uNxScBLjr8UUzCYNqTCdHhMVBxc/source

O domínio público estava associado a esse deploy na conferência de 27/08.
A diferença não era outro projeto: o código enviado diretamente à Vercel
não havia sido sincronizado com a branch `main`.

## Cópias e integridade

A pasta original `D:/Projetos/ecurta-io` foi preservada. A recuperação está em:

- `D:/Projetos/ecurta-io-recuperado-20260827/source`: arquivos exatos do deploy;
- `D:/Projetos/ecurta-io-recuperado-20260827/repository`: cópia Git para validação;
- `D:/Projetos/ecurta-io-recuperado-20260827/recovery-manifest.json`: inventário
  com SHA-1 da Vercel e SHA-256 calculado localmente;
- `D:/Projetos/ecurta-io-recuperado-20260827/comparison.json`: comparação completa.

Foram baixados 111 arquivos, todos verificados contra o SHA-1 informado pela
Vercel. Ignorando apenas diferenças CRLF/LF, há 50 novos, 22 modificados e 39
iguais à pasta original. `next-env.d.ts` está entre os novos, mas é gerado pelo
Next.js e não deve ser versionado. O `.gitignore` original não fazia parte do
deploy; foi preservado como base e ajustado para proteger metadados locais do
Supabase e permitir somente o exemplo de ambiente sem segredos.

Não foram baixados os nove arquivos de `supabase/.temp/`, nem o cache
`tsconfig.tsbuildinfo`. Os arquivos compilados `out` também não são fontes e
não foram importados. A pasta vazia `encurta-io` no deploy não continha código.
Nenhuma credencial de produção foi exportada. Os campos de segredo em
`.env.example` estão vazios. A busca por padrões de tokens, chaves privadas,
JWTs e URLs com senha não encontrou correspondências nos arquivos recuperados;
isso não substitui uma auditoria de segurança completa.

## Conteúdo recuperado

- API privada com Bearer, HMAC, idempotência e limites de uso;
- painel de integração do Alcance IA e documentação autenticada `/docs`;
- componentes e estilos atualizados das páginas públicas e administrativas;
- testes e cinco migrations posteriores à versão antiga.

Nenhuma migration foi executada. Não reaplicar migrations em produção sem
conferir antes o histórico do banco.

## Validação local

Executados na cópia isolada, sem credenciais de produção:

- `npm ci --ignore-scripts --no-audit --no-fund`;
- `npm test`: 33 testes aprovados em quatro arquivos;
- `npm run build`: compilação aprovada, incluindo as rotas da API e `/docs`;
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.

Esta recuperação não valida chamadas autenticadas à API real ou operações
no banco de produção.

## Sincronização e Geobot

A cópia Git usa a branch local `recovery/production-2026-07-21`. Não publicar
automaticamente na `main`: um push pode disparar um novo deploy na Vercel.
Primeiro revisar a recuperação e decidir quando autorizar a publicação.

A recuperação não altera a lógica da aplicação nem habilita a Geobot.
A versão publicada usa credenciais e configurações `ALCANCE_IA_*`, chaves de
configuração `integrations.alcance_ia.*`, e regras de origem/posse do Alcance no
serviço e nas funções SQL. A integração da Geobot exige credenciais próprias,
isolamento por origem, limites e testes de compatibilidade com o Alcance.
Não trocar as credenciais do Alcance pelas da Geobot.

O endpoint canônico para o cliente Geobot é `https://www.encurta.io`.
O domínio sem `www` retorna redirecionamento; o cliente Geobot não segue
redirecionamentos ao enviar credenciais.

O servidor recuperado aceita exclusivamente destinos WhatsApp e valida
telefones brasileiros. Ele já oferece slug opcional no POST e alteração de
slug por PATCH; a documentação antiga do Alcance usada na análise inicial
não cobria essas funcionalidades. Elas ainda não foram expostas na interface
Geobot preparada anteriormente.
