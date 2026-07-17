import {RESERVED_SLUGS} from "./reserved-slugs";const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function isValidSlug(slug:string){return /^[A-Za-z0-9]{8,32}$/.test(slug)&&!RESERVED_SLUGS.has(slug.toLowerCase())}
export function generateShortSlug(length=8){if(!Number.isInteger(length)||length<8||length>32)throw new Error("Tamanho de slug inválido");return Array.from(crypto.getRandomValues(new Uint8Array(length)),b=>alphabet[b%alphabet.length]).join("")}
