import { z } from "zod";
import { getRequestIntegrationConfig } from "@/lib/integrations/config";
import { authenticateIntegrationRequest } from "@/lib/integrations/alcance-ia/authenticate";
import {
  InternalApiError,
  errorResponse,
  responseHeaders,
} from "@/lib/integrations/alcance-ia/errors";
import { updateInternalLinkSchema } from "@/lib/integrations/alcance-ia/schemas";
import {
  getIntegrationSettings,
  deleteInternalLink,
  getInternalLink,
  updateInternalLink,
} from "@/lib/integrations/alcance-ia/service";
import { enforceIntegrationRateLimit } from "@/lib/integrations/alcance-ia/rate-limit";
import {
  recordIntegrationEvent,
  safeTechnicalLog,
} from "@/lib/integrations/alcance-ia/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function rateLimits(
  loaded: Awaited<ReturnType<typeof getIntegrationSettings>>,
  config: ReturnType<typeof getRequestIntegrationConfig>,
) {
  const setting = (key: string, fallback: number) =>
    Number(loaded.settings.get(key) ?? fallback);
  return {
    minute: setting(
      `integrations.${config.integration}.minute_limit`,
      config.minuteLimit,
    ),
    hour: setting(
      `integrations.${config.integration}.hourly_limit`,
      config.hourlyLimit,
    ),
    day: setting(
      `integrations.${config.integration}.daily_limit`,
      config.dailyLimit,
    ),
  };
}

function checkedId(id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new InternalApiError("LINK_NOT_FOUND", 404);
  return id;
}

export async function GET(request: Request, { params }: Context) {
  const started = Date.now();
  let source: "alcance_ia" | "geobot" = "alcance_ia";
  let requestId: string | null = request.headers.get("x-request-id");
  try {
    const config = getRequestIntegrationConfig(request);
    source = config.integration;
    const auth = await authenticateIntegrationRequest(request, "", config);
    requestId = auth.requestId;
    const id = checkedId((await params).id);
    const loaded = await getIntegrationSettings();
    const rateHeaders = await enforceIntegrationRateLimit(
      loaded.db,
      auth.source,
      "/api/internal/v1/links/{id}",
      requestId,
      rateLimits(loaded, config),
      "GET",
    );
    const result = await Promise.race([
      getInternalLink(id, config.integration),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new InternalApiError("SERVICE_UNAVAILABLE", 503, true)),
          config.timeoutMs,
        ),
      ),
    ]);
    await recordIntegrationEvent(result.db, {
      source,
      requestId,
      endpoint: "/api/internal/v1/links/{id}",
      method: "GET",
      statusCode: 200,
      action: "link_queried",
      durationMs: Date.now() - started,
      shortLinkId: result.data.id,
    });
    safeTechnicalLog({
      requestId,
      endpoint: "links.get",
      status: 200,
      durationMs: Date.now() - started,
      linkId: result.data.id,
    });
    return Response.json(
      { data: result.data, meta: { requestId } },
      { headers: responseHeaders(requestId, rateHeaders) },
    );
  } catch (error) {
    const apiError =
      error instanceof InternalApiError
        ? error
        : new InternalApiError("INTERNAL_ERROR", 500, true);
    safeTechnicalLog({
      requestId: requestId ?? "missing",
      endpoint: "links.get",
      status: apiError.status,
      durationMs: Date.now() - started,
      code: apiError.code,
    });
    return errorResponse(
      apiError,
      requestId,
      apiError.code === "RATE_LIMIT_EXCEEDED"
        ? { "Retry-After": "60" }
        : undefined,
    );
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const started = Date.now();
  let source: "alcance_ia" | "geobot" = "alcance_ia";
  let requestId: string | null = request.headers.get("x-request-id");
  try {
    const config = getRequestIntegrationConfig(request);
    source = config.integration;
    const auth = await authenticateIntegrationRequest(request, "", config);
    requestId = auth.requestId;
    const id = checkedId((await params).id);
    const loaded = await getIntegrationSettings();
    const rateHeaders = await enforceIntegrationRateLimit(
      loaded.db,
      auth.source,
      "/api/internal/v1/links/{id}",
      requestId,
      rateLimits(loaded, config),
      "DELETE",
    );
    const result = await Promise.race([
      deleteInternalLink(id, config.integration),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new InternalApiError("SERVICE_UNAVAILABLE", 503, true)),
          config.timeoutMs,
        ),
      ),
    ]);
    await recordIntegrationEvent(result.db, {
      source,
      requestId,
      endpoint: "/api/internal/v1/links/{id}",
      method: "DELETE",
      statusCode: 200,
      action: "link_deleted",
      durationMs: Date.now() - started,
      shortLinkId: id,
    });
    return Response.json(
      { data: { id, deleted: true }, meta: { requestId } },
      { headers: responseHeaders(requestId, rateHeaders) },
    );
  } catch (error) {
    const apiError =
      error instanceof InternalApiError
        ? error
        : new InternalApiError("INTERNAL_ERROR", 500, true);
    safeTechnicalLog({
      requestId: requestId ?? "missing",
      endpoint: "links.delete",
      status: apiError.status,
      durationMs: Date.now() - started,
      code: apiError.code,
    });
    return errorResponse(
      apiError,
      requestId,
      apiError.code === "RATE_LIMIT_EXCEEDED"
        ? { "Retry-After": "60" }
        : undefined,
    );
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const started = Date.now();
  let source: "alcance_ia" | "geobot" = "alcance_ia";
  let requestId: string | null = request.headers.get("x-request-id");
  let db: Awaited<ReturnType<typeof getIntegrationSettings>>["db"] | null =
    null;
  try {
    const config = getRequestIntegrationConfig(request);
    source = config.integration;
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      throw new InternalApiError("INVALID_CONTENT_TYPE", 415);
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > config.maxBodyBytes)
      throw new InternalApiError("PAYLOAD_TOO_LARGE", 413);
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > config.maxBodyBytes)
      throw new InternalApiError("PAYLOAD_TOO_LARGE", 413);

    const auth = await authenticateIntegrationRequest(request, rawBody, config);
    requestId = auth.requestId;
    const id = checkedId((await params).id);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new InternalApiError("VALIDATION_ERROR", 400);
    }
    const parsed = updateInternalLinkSchema.safeParse(json);
    if (!parsed.success)
      throw new InternalApiError(
        "VALIDATION_ERROR",
        422,
        false,
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );

    const loaded = await getIntegrationSettings();
    db = loaded.db;
    const rateHeaders = await enforceIntegrationRateLimit(
      db,
      auth.source,
      "/api/internal/v1/links/{id}",
      requestId,
      rateLimits(loaded, config),
      "PATCH",
    );
    const result = await Promise.race([
      updateInternalLink(id, parsed.data, requestId, config.integration),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new InternalApiError("SERVICE_UNAVAILABLE", 503, true)),
          config.timeoutMs,
        ),
      ),
    ]);
    await recordIntegrationEvent(result.db, {
      source,
      requestId,
      endpoint: "/api/internal/v1/links/{id}",
      method: "PATCH",
      statusCode: 200,
      action: result.changed ? "link_slug_updated" : "link_slug_unchanged",
      durationMs: Date.now() - started,
      shortLinkId: result.data.id,
    });
    safeTechnicalLog({
      requestId,
      endpoint: "links.patch",
      status: 200,
      durationMs: Date.now() - started,
      linkId: result.data.id,
    });
    return Response.json(
      { data: result.data, meta: { requestId, changed: result.changed } },
      { headers: responseHeaders(requestId, rateHeaders) },
    );
  } catch (error) {
    const apiError =
      error instanceof InternalApiError
        ? error
        : new InternalApiError("INTERNAL_ERROR", 500, true);
    if (db && requestId)
      await recordIntegrationEvent(db, {
        source,
        requestId,
        endpoint: "/api/internal/v1/links/{id}",
        method: "PATCH",
        statusCode: apiError.status,
        action: "request_failed",
        durationMs: Date.now() - started,
        errorCode: apiError.code,
      });
    safeTechnicalLog({
      requestId: requestId ?? "missing",
      endpoint: "links.patch",
      status: apiError.status,
      durationMs: Date.now() - started,
      code: apiError.code,
    });
    return errorResponse(
      apiError,
      requestId,
      apiError.code === "RATE_LIMIT_EXCEEDED"
        ? { "Retry-After": "60" }
        : undefined,
    );
  }
}
