import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InternalApiError } from "./errors";

type Limits = { minute: number; hour: number; day: number };

export async function enforceIntegrationRateLimit(
  db: SupabaseClient,
  source: string,
  endpoint: string,
  requestId: string,
  limits: Limits,
  method = "GET",
) {
  const { data, error } = await db.rpc(
    "check_and_record_integration_rate_limit_v2",
    {
      p_source: source,
      p_endpoint: endpoint,
      p_method: method,
      p_request_id: requestId,
      p_minute_limit: limits.minute,
      p_hour_limit: limits.hour,
      p_day_limit: limits.day,
    },
  );
  if (error) throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
  const row = (
    data as {
      allowed: boolean;
      limit_value: number;
      remaining: number;
      reset_at: number;
    }[] | null
  )?.[0];
  if (!row) throw new InternalApiError("SERVICE_UNAVAILABLE", 503, true);
  if (!row.allowed)
    throw new InternalApiError("RATE_LIMIT_EXCEEDED", 429, true);
  return {
    "X-RateLimit-Limit": String(row.limit_value),
    "X-RateLimit-Remaining": String(row.remaining),
    "X-RateLimit-Reset": String(row.reset_at),
  };
}
