import { getRequestIntegrationConfig } from "@/lib/integrations/config";
import { authenticateIntegrationRequest } from "@/lib/integrations/alcance-ia/authenticate";
import { InternalApiError, errorResponse, responseHeaders } from "@/lib/integrations/alcance-ia/errors";
import { getIntegrationSettings } from "@/lib/integrations/alcance-ia/service";
import { getAllowedShortDomains, getDefaultShortDomain } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let requestId: string | null = request.headers.get("x-request-id");
  try {
    const config = getRequestIntegrationConfig(request);
    const auth = await authenticateIntegrationRequest(request, "", config);
    requestId = auth.requestId;
    const { settings } = await getIntegrationSettings();
    const allowedDomains = getAllowedShortDomains(settings.get("shortener.allowed_domains"));
    return Response.json(
      { data: { domains: allowedDomains, defaultDomain: getDefaultShortDomain(allowedDomains, settings.get("shortener.domain")) }, meta: { requestId } },
      { headers: responseHeaders(requestId) },
    );
  } catch (error) {
    const apiError = error instanceof InternalApiError ? error : new InternalApiError("INTERNAL_ERROR", 500, true);
    return errorResponse(apiError, requestId);
  }
}
