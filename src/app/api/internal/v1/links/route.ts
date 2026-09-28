import { getRequestIntegrationConfig } from "@/lib/integrations/config";
import { authenticateIntegrationRequest } from "@/lib/integrations/alcance-ia/authenticate";
import {
  InternalApiError,
  errorResponse,
  responseHeaders,
} from "@/lib/integrations/alcance-ia/errors";
import { createInternalLinkSchema, createGeobotLinkSchema } from "@/lib/integrations/alcance-ia/schemas";
import {
  createInternalLink,
  getIntegrationSettings,
} from "@/lib/integrations/alcance-ia/service";
import { enforceIntegrationRateLimit } from "@/lib/integrations/alcance-ia/rate-limit";
import {
  recordIntegrationEvent,
  safeTechnicalLog,
} from "@/lib/integrations/alcance-ia/observability";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const started = Date.now();
  let requestId: string | null = request.headers.get("x-request-id");
  let source: "alcance_ia" | "geobot" = "alcance_ia";
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
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new InternalApiError("VALIDATION_ERROR", 400);
    }
    const parsed = (source === "geobot" ? createGeobotLinkSchema : createInternalLinkSchema).safeParse(json);
    if (!parsed.success)
      throw new InternalApiError(
        "VALIDATION_ERROR",
        422,
        false,
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
    const loaded = await getIntegrationSettings();
    db = loaded.db;
    const setting = (key: string, fallback: number) =>
      Number(loaded.settings.get(key) ?? fallback);
    const rateHeaders = await enforceIntegrationRateLimit(
      db,
      auth.source,
      "/api/internal/v1/links",
      requestId,
      {
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
      },
      "POST",
    );
    const operation = createInternalLink(
      parsed.data,
      requestId,
      config.integration,
    );
    const result = await Promise.race([
      operation,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new InternalApiError("SERVICE_UNAVAILABLE", 503, true)),
          config.timeoutMs,
        ),
      ),
    ]);
    const status = result.replay ? 200 : 201;
    await recordIntegrationEvent(result.db, {
      source,
      requestId,
      endpoint: "/api/internal/v1/links",
      method: "POST",
      statusCode: status,
      action: result.replay ? "idempotent_replay" : "link_created",
      durationMs: Date.now() - started,
      shortLinkId: result.data.id,
      externalUserId: parsed.data.externalUserId,
    });
    safeTechnicalLog({
      requestId,
      endpoint: "links.create",
      status,
      durationMs: Date.now() - started,
      linkId: result.data.id,
      replay: result.replay,
    });
    return Response.json(
      {
        data: result.data,
        meta: { requestId, idempotentReplay: result.replay },
      },
      { status, headers: responseHeaders(requestId, rateHeaders) },
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
        endpoint: "/api/internal/v1/links",
        method: "POST",
        statusCode: apiError.status,
        action: "request_failed",
        durationMs: Date.now() - started,
        errorCode: apiError.code,
      });
    safeTechnicalLog({
      requestId: requestId ?? "missing",
      endpoint: "links.create",
      status: apiError.status,
      durationMs: Date.now() - started,
      code: apiError.code,
    });
    const extra =
      apiError.code === "RATE_LIMIT_EXCEEDED"
        ? { "Retry-After": "60" }
        : undefined;
    return errorResponse(apiError, requestId, extra);
  }
}
