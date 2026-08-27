# API privada Encurta.io × Alcance IA

Integração exclusiva entre os backends. Nunca chame estes endpoints do navegador.

- `POST /api/internal/v1/links`: cria exclusivamente destino WhatsApp; retorna `201`, ou `200` no replay.
- `GET /api/internal/v1/links/{id}`: consulta somente links de origem `alcance_ia`.

As respostas usam `no-store` e não expõem telefone, mensagem, destino ou hashes.

```ts
import {createHash, createHmac, randomUUID} from "node:crypto";
const path = "/api/internal/v1/links";
const body = JSON.stringify({destinationType:"whatsapp",phone:"5571999999999",message:"Olá!",externalResourceId:"whatsapp_link_generator"});
const requestId = `req_${randomUUID().replaceAll("-", "")}`;
const timestamp = new Date().toISOString();
const bodyHash = createHash("sha256").update(body,"utf8").digest("hex");
const payload = [timestamp,"POST",path,requestId,bodyHash].join("\n");
const signature = `sha256=${createHmac("sha256",process.env.ENCURTA_HMAC_SECRET!).update(payload).digest("hex")}`;
const response = await fetch(`${process.env.ENCURTA_API_URL}${path}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.ENCURTA_API_KEY}`,"X-Integration-Source":"alcance_ia","X-Request-Id":requestId,"X-Timestamp":timestamp,"X-Signature":signature},body,cache:"no-store",signal:AbortSignal.timeout(10_000)});
const result:unknown=await response.json();
if(!response.ok)throw new Error(`Encurta.io respondeu ${response.status}`);
```

Em timeout ou 5xx, repita com o mesmo request ID e corpo. A retenção dos registros de idempotência é de sete dias.
