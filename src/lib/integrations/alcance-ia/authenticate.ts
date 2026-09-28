import "server-only";
import{InternalApiError}from"./errors";
import{getAlcanceIaEnvConfig}from"./config";
import{safeEqual,verifyIntegrationSignature}from"./request-signature";
import{getServiceClient}from"@/lib/supabase/server";
import{geobotApiKeyPrefix,getBearerApiKey,hashIntegrationApiKey}from"@/lib/integrations/geobot-api-keys";
const requestIdPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$/;
type IntegrationAuthConfig={enabled:boolean;apiKey:string|null;source:string;authMode?:"bearer"|"bearer_hmac";allowedOrigin:string|null;hmacSecret?:string|null;maxClockSkewSeconds?:number};
export function verifyIntegrationApiKey(header:string|null,expected:string|null){if(!header||!expected||header.includes(","))return false;const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(header);return Boolean(match&&safeEqual(match[1],expected))}
export async function authenticateIntegrationRequest(request:Request,rawBody:string,config:IntegrationAuthConfig=getAlcanceIaEnvConfig()){
  const requestId=request.headers.get("x-request-id");
  if(!config.enabled)throw new InternalApiError("INTEGRATION_DISABLED",403);
  const url=new URL(request.url),configuredHost=new URL(process.env.NEXT_PUBLIC_SHORT_DOMAIN??"https://encurta.io").hostname,canonicalHost=configuredHost.replace(/^www\./,""),vercelHost=process.env.VERCEL_URL;
  const allowedHosts=new Set([configuredHost,canonicalHost,`www.${canonicalHost}`,vercelHost].filter((host):host is string=>Boolean(host)));
  const local=url.hostname==="localhost"||url.hostname==="127.0.0.1";
  if(!local&&url.protocol!=="https:")throw new InternalApiError("UNAUTHORIZED",401);
  if(!local&&!allowedHosts.has(url.hostname))throw new InternalApiError("UNAUTHORIZED",401);
  if(!requestId||!requestIdPattern.test(requestId)||requestId.includes(","))throw new InternalApiError("INVALID_REQUEST_ID",400);
  if(request.headers.get("x-integration-source")!==config.source)throw new InternalApiError("UNAUTHORIZED",401);
  let authorized=verifyIntegrationApiKey(request.headers.get("authorization"),config.apiKey);
  if(!authorized&&config.source==="geobot"){
    const key=getBearerApiKey(request.headers.get("authorization")),db=getServiceClient();
    if(key?.startsWith(geobotApiKeyPrefix)&&db){const{data}=await db.from("integration_api_keys").select("id").eq("integration_source","geobot").eq("key_hash",hashIntegrationApiKey(key)).is("revoked_at",null).maybeSingle();authorized=Boolean(data);if(data)void db.from("integration_api_keys").update({last_used_at:new Date().toISOString()}).eq("id",data.id)}
  }
  if(!authorized)throw new InternalApiError("UNAUTHORIZED",401);
  if(config.authMode!=="bearer"){
    const timestamp=request.headers.get("x-timestamp");
    if(!timestamp||timestamp.includes(","))throw new InternalApiError("REQUEST_EXPIRED",401);
    const time=Date.parse(timestamp),skew=Math.abs(Date.now()-time);
    if(Number.isNaN(time)||skew>config.maxClockSkewSeconds!*1000)throw new InternalApiError("REQUEST_EXPIRED",401);
    const signature=request.headers.get("x-signature");
    if(!config.hmacSecret||!signature||!verifyIntegrationSignature(config.hmacSecret,signature,{timestamp,method:request.method,path:new URL(request.url).pathname,requestId,body:rawBody}))throw new InternalApiError("INVALID_SIGNATURE",401);
  }
  const origin=request.headers.get("origin");
  if(origin&&(!config.allowedOrigin||origin!==config.allowedOrigin))throw new InternalApiError("UNAUTHORIZED",401);
  return{requestId,source:config.source};
}
export function isValidIntegrationRequestId(value:string){return requestIdPattern.test(value)}
