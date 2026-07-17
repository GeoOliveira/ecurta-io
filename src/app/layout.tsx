import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"Encurta.io | Links curtos simples e confiáveis", description:"O Encurta.io oferece links curtos fáceis de compartilhar, com redirecionamento seguro e gerenciamento centralizado." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><body>{children}</body></html>; }
