# Autenticação da API interna

Para Geobot são obrigatórios Bearer, `X-Integration-Source: geobot`, `X-Request-Id` e JSON no POST. A API key é comparada em tempo constante. `X-Timestamp` e `X-Signature` são exclusivos do Alcance IA, que mantém Bearer + HMAC. Query, cookie e corpo não são fontes de credencial. Não há CORS aberto. Ambiente e chaves existem somente no backend. A integração precisa estar habilitada no ambiente e no banco.
