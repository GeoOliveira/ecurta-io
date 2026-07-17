# Arquitetura

Next.js App Router serve a Home, páginas institucionais, painel e a rota Node `/{slug}`. O redirect consulta a RPC restrita, revalida o destino e responde 307. O Supabase armazena dados e aplica RLS.
