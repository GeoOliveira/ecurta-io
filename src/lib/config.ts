export const getShortDomain=()=> (process.env.NEXT_PUBLIC_SHORT_DOMAIN??"https://encurta.io").replace(/\/$/,"");
export const allowedHosts=()=> (process.env.ALLOWED_DESTINATION_HOSTS??"wa.me").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
