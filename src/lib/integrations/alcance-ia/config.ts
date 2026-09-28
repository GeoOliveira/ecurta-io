import "server-only";
import {z}from"zod";
const integer=(fallback:number,min:number,max:number)=>z.coerce.number().int().min(min).max(max).catch(fallback);
const envSchema=z.object({
  ALCANCE_IA_INTEGRATION_ENABLED:z.enum(["true","false"]).catch("false"),
  ALCANCE_IA_API_KEY:z.string().min(24).optional(),
  ALCANCE_IA_HMAC_SECRET:z.string().min(32).optional(),
  ALCANCE_IA_ALLOWED_SOURCE:z.string().regex(/^[a-z0-9_]+$/).catch("alcance_ia"),
  ALCANCE_IA_ALLOWED_ORIGIN:z.url().optional(),
  ALCANCE_IA_REQUEST_TIMEOUT_MS:integer(10000,1000,30000),
  ALCANCE_IA_MAX_CLOCK_SKEW_SECONDS:integer(300,30,900),
  ALCANCE_IA_MINUTE_LINK_LIMIT:integer(20,1,10000),
  ALCANCE_IA_HOURLY_LINK_LIMIT:integer(200,1,100000),
  ALCANCE_IA_DAILY_LINK_LIMIT:integer(1000,1,1000000),
  ALCANCE_IA_REQUEST_BODY_MAX_BYTES:integer(8192,1024,65536),
});
export type AlcanceIaEnvConfig=ReturnType<typeof getAlcanceIaEnvConfig>;
export function getAlcanceIaEnvConfig(){const value=envSchema.parse(process.env);return{enabled:value.ALCANCE_IA_INTEGRATION_ENABLED==="true",apiKey:value.ALCANCE_IA_API_KEY??null,hmacSecret:value.ALCANCE_IA_HMAC_SECRET??null,source:value.ALCANCE_IA_ALLOWED_SOURCE,authMode:"bearer_hmac" as const,allowedOrigin:value.ALCANCE_IA_ALLOWED_ORIGIN??null,timeoutMs:value.ALCANCE_IA_REQUEST_TIMEOUT_MS,maxClockSkewSeconds:value.ALCANCE_IA_MAX_CLOCK_SKEW_SECONDS,minuteLimit:value.ALCANCE_IA_MINUTE_LINK_LIMIT,hourlyLimit:value.ALCANCE_IA_HOURLY_LINK_LIMIT,dailyLimit:value.ALCANCE_IA_DAILY_LINK_LIMIT,maxBodyBytes:value.ALCANCE_IA_REQUEST_BODY_MAX_BYTES}}
export function integrationSecretsConfigured(config=getAlcanceIaEnvConfig()){return Boolean(config.apiKey&&config.hmacSecret)}
