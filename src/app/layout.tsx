import type{Metadata,Viewport}from"next";
import{Montserrat}from"next/font/google";
import"./globals.css";
const montserrat=Montserrat({subsets:["latin"],display:"swap",variable:"--font-montserrat",weight:["400","500","600","700","800"]});
const domain=process.env.NEXT_PUBLIC_SHORT_DOMAIN??"https://encurta.io";
const structuredData={"@context":"https://schema.org","@type":"WebApplication",name:"Encurta.io",url:domain,applicationCategory:"BusinessApplication",operatingSystem:"Web",description:"Serviço de links curtos autorizados com redirecionamento validado."};
export const metadata:Metadata={metadataBase:new URL(domain),title:"Encurta.io | Links curtos simples e seguros",description:"Crie e gerencie links curtos com redirecionamento seguro, controle de status e métricas de acesso.",alternates:{canonical:"/"},openGraph:{type:"website",locale:"pt_BR",siteName:"Encurta.io",title:"Encurta.io | Links curtos simples e seguros",description:"Links autorizados com redirecionamento validado, controle de status e métricas de acesso.",url:"/"},twitter:{card:"summary",title:"Encurta.io | Links curtos simples e seguros",description:"Links autorizados com redirecionamento validado e gestão centralizada."},robots:{index:true,follow:true}};
export const viewport:Viewport={themeColor:"#2563EB",colorScheme:"light"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body className={montserrat.variable}><script type="application/ld+json">{JSON.stringify(structuredData)}</script>{children}</body></html>}
