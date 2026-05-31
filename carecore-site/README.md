# CareCore+ — Site institucional

Site marketing estático em **Astro** + Tailwind. Deploy separado do app operacional (`carecore-front`).

## Arquitetura de domínios

| URL | Função |
|-----|--------|
| `https://carecoreplus.com.br` | Este site (Vercel) |
| `https://app.carecoreplus.com.br` | Sistema CareCore+ — login (Vercel, outro projeto) |
| `https://api.carecoreplus.com.br` | API FastAPI (Render/Railway, na subida do SaaS) |

## Desenvolvimento local

```bash
cd carecore-site
npm install
npm run dev
```

Abre em `http://localhost:4321` (porta padrão do Astro).

## Build

```bash
npm run build
npm run preview
```

## Deploy na Vercel

1. Novo projeto Vercel apontando para a pasta `carecore-site`
2. Framework: **Astro**
3. Domínio: `carecoreplus.com.br` (+ redirect `www` → raiz)
4. **Não** misturar com o deploy do `carecore-front` (projeto separado)

## Segurança

- Site 100% estático — sem API, banco ou segredos
- Headers de segurança em `vercel.json`
- Botão **Entrar** aponta para `app.carecoreplus.com.br` (config em `src/config/site.js`)

## Assets

Screenshots em `public/telas/` vêm da pasta `apresentacao/telas/` do monorepo (copiar ao atualizar).

Logo: `public/logo.png` (origem: `apresentacao/logo.png`).
