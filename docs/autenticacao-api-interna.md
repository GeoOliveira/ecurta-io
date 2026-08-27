# Autenticação da API interna

São obrigatórios Bearer, `X-Integration-Source`, `X-Request-Id`, `X-Timestamp`, `X-Signature` e JSON no POST. A API key é comparada em tempo constante. Query, cookie e corpo não são fontes de credencial. Não há CORS aberto. Ambiente e chaves existem somente no backend. A integração precisa estar habilitada no ambiente e no banco.
