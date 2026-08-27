# Assinatura HMAC

Use `X-Signature: sha256=<hex>` sobre `timestamp`, método, path, request ID e `sha256(raw_body)`, separados por quebra de linha. No GET, o corpo é vazio. O timestamp precisa estar dentro da tolerância configurada. Algoritmo, assinatura ou corpo alterados são rejeitados.
