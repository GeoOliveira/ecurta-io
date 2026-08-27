# Idempotência e replay

O banco reserva `(integration_source, request_id)` na mesma transação da criação. Mesmo ID e payload devolvem o link original; payload diferente retorna `409 IDEMPOTENCY_CONFLICT`; operação inconclusiva retorna erro retryable. O hash não é exposto.
