import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
function getSupabaseConfig(){const url=process.env.SUPABASE_URL,anonKey=process.env.SUPABASE_ANON_KEY;return url&&anonKey?{url,anonKey}:null}
export async function getAuthClient(){const config=getSupabaseConfig();if(!config)return null;const cookieStore=await cookies();return createServerClient(config.url,config.anonKey,{cookies:{getAll:()=>cookieStore.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>cookieStore.set(name,value,options))}catch{}}}})}
export function getServiceClient(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?createClient(url,key,{auth:{persistSession:false}}):null}
