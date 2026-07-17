# Redirecionamento

A rota valida o slug, consulta `resolve_short_link`, verifica status, expiração e destino, então responde 307. Há cache em memória com TTL de 60 segundos como otimização local; invalidação distribuída deve ser adicionada antes de múltiplas regiões.
