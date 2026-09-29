import { z } from "zod";
import { getRequestIntegrationConfig } from "@/lib/integrations/config";
import { authenticateIntegrationRequest } from "@/lib/integrations/alcance-ia/authenticate";
import {
  InternalApiError,
  errorResponse,
  responseHeaders,
} from "@/lib/integrations/alcance-ia/errors";
import {
  getIntegrationSettings,
  getInternalLinkMetrics,
} from "@/lib/integrations/alcance-ia/service";
import { enforceIntegrationRateLimit } from "@/lib/integrations/alcance-ia/rate-limit";
import {
  recordIntegrationEvent,
  safeTechnicalLog,
} from "@/lib/integrations/alcance-ia/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idsSchema = z.array(z.uuid()).min(1).max(200);

export async function GET(request: Request) {
  const started = Date.now();
  let source: "alcance_ia" | "geobot" = "alcance_ia";
  let requestId: string | null = request.headers.get("x-request-id");
  try {
    const config = getRequestIntegrationConfig(request);
    source = config.integration;
    const auth = await authenticateIntegrationRequest(request, "", config);
    requestId = auth.requestId;
    const ids = idsSchema.safeParse(
      new URL(request.url).searchParams.getAll("id"),
    );
    if (!ids.success) throw new InternalApiError("VALIDATION_ERROR", 422);

    const loaded = await getIntegrationSettings();
    const setting = (key: string, fallback: number) =>
      Number(loaded.settings.get(key) ?? fallback);
    const rateHeaders = await enforceIntegrationRateLimit(
      loaded.db,
      auth.source,
      "/api/internal/v1/links/metrics",
      requestId,
      {
        minute: setting(`integrations.${source}.minute_limit`, config.minuteLimit),
        hour: setting(`integrations.${source}.hourly_limit`, config.hourlyLimit),
        day: setting(`integrations.${source}.daily_limit`, config.dailyLimit),
      },
      "GET",
    );
    const result = await Promise.race([
      getInternalLinkMetrics(ids.data, source),
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
      endpoint: "/api/internal/v1/links/metrics",
      method: "GET",
      statusCode: 200,
      action: "link_metrics_queried",
      durationMs: Date.now() - started,
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
      endpoint: "links.metrics",
      status: apiError.status,
      durationMs: Date.now() - started,
      code: apiError.code,
    });
    return errorResponse(
      apiError,
      requestId,
      apiError.code === "RATE_LIMIT_EXCEEDED" ? { "Retry-After": "60" } : undefined,
    );
  }
}
