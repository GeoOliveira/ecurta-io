"use server";
import{redirect}from"next/navigation";
import{z}from"zod";
import{getAdminSession}from"@/lib/auth";
import{getServiceClient}from"@/lib/supabase/server";
import{createAdministrativeWhatsAppShortLink}from"@/lib/short-links/service";
const schema=z.object({phone:z.string().min(1).max(32),message:z.string().max(1000).optional(),expiresAt:z.string().optional(),note:z.string().max(500).optional()});
export async function createShortLinkAction(formData:FormData){
  const session=await getAdminSession();if(!session||session.role==="analyst")redirect("/admin/links/novo?erro=Sem+permissão");
  const parsed=schema.safeParse({phone:formData.get("phone"),message:formData.get("message")||undefined,expiresAt:formData.get("expiresAt")||undefined,note:formData.get("note")||undefined});if(!parsed.success)redirect("/admin/links/novo?erro=Revise+os+campos+informados");
  try{const link=await createAdministrativeWhatsAppShortLink({...parsed.data,createdBy:session.userId});const db=getServiceClient();await db?.from("audit_logs").insert({actor_user_id:session.userId,action:"create",entity_type:"short_link",entity_id:link.id,after_data:{slug:link.slug,expires_at:parsed.data.expiresAt||null}});redirect(`/admin/links?criado=${link.slug}`)}catch(error){if(error&&typeof error==="object"&&"digest"in error)throw error;redirect("/admin/links/novo?erro=Não+foi+possível+salvar+o+link")}
}
