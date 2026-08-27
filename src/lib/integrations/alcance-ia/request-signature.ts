import{createHash,createHmac,timingSafeEqual}from"node:crypto";
export function sha256(value:string){return createHash("sha256").update(value,"utf8").digest("hex")}
export function buildIntegrationSignaturePayload(input:{timestamp:string;method:string;path:string;requestId:string;body:string}){return[input.timestamp,input.method.toUpperCase(),input.path,input.requestId,sha256(input.body)].join("\n")}
export function createIntegrationSignature(secret:string,input:{timestamp:string;method:string;path:string;requestId:string;body:string}){return`sha256=${createHmac("sha256",secret).update(buildIntegrationSignaturePayload(input),"utf8").digest("hex")}`}
export function safeEqual(a:string,b:string){const left=createHash("sha256").update(a).digest(),right=createHash("sha256").update(b).digest();return timingSafeEqual(left,right)}
export function verifyIntegrationSignature(secret:string,provided:string,input:{timestamp:string;method:string;path:string;requestId:string;body:string}){if(!/^sha256=[a-f0-9]{64}$/i.test(provided)||provided.includes(","))return false;return safeEqual(createIntegrationSignature(secret,input),provided.toLowerCase())}
