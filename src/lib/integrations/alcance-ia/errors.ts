import type {
  InternalApiErrorCode,
  InternalApiErrorResponse,
} from "./types";

const messages: Record<InternalApiErrorCode, string> = {
  INTEGRATION_DISABLED: "A integração está temporariamente indisponível.",
  UNAUTHORIZED: "Não foi possível autenticar a integração.",
  INVALID_SIGNATURE: "Não foi possível autenticar a integração.",
  REQUEST_EXPIRED: "A solicitação está fora da janela permitida.",
  INVALID_REQUEST_ID: "O identificador da solicitação é inválido.",
  INVALID_CONTENT_TYPE: "O Content-Type deve ser application/json.",
  PAYLOAD_TOO_LARGE: "O corpo da solicitação excede o limite permitido.",
  VALIDATION_ERROR: "Revise os dados enviados.",
  INVALID_PHONE: "Informe um celular brasileiro válido.",
  INVALID_EXPIRATION: "A data de expiração é inválida.",
  RATE_LIMIT_EXCEEDED: "O limite temporário da integração foi atingido.",
  IDEMPOTENCY_CONFLICT: "O identificador já foi usado com dados diferentes.",
  SLUG_UNAVAILABLE: "Este slug já está em uso.",
  LINK_NOT_FOUND: "Link não encontrado.",
  INTEGRATION_LINK_ACCESS_DENIED: "A integração não pode consultar este link.",
  CREATION_DISABLED: "A criação ou alteração de links está temporariamente pausada.",
  SERVICE_UNAVAILABLE: "O serviço está temporariamente indisponível.",
  INTERNAL_ERROR: "Não foi possível concluir a solicitação.",
};

export class InternalApiError extends Error {
  constructor(
    public code: InternalApiErrorCode,
    public status: number,
    public retryable = false,
    public details?: Record<string, string[]>,
  ) {
    super(messages[code]);
    this.name = "InternalApiError";
  }
}

export function errorResponse(
  error: InternalApiError,
  requestId: string | null,
  headers?: HeadersInit,
) {
  const body: InternalApiErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.details ? { details: error.details } : {}),
    },
    meta: { requestId },
  };
  return Response.json(body, {
    status: error.status,
    headers: responseHeaders(requestId, headers),
  });
}

export function responseHeaders(requestId: string | null, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  if (requestId) headers.set("X-Request-Id", requestId);
  return headers;
}
