# Client (React + Next.js + TypeScript + Tailwind)

Página que o usuário acessa, com **renderização no servidor (SSR)** e rotas baseadas em arquivos.

## Stack

- **Next.js 15** — React framework com SSR por padrão no App Router
- **TypeScript**
- **Tailwind CSS**
- **App Router** — cada `app/**/page.tsx` vira uma rota; componentes são Server Components (SSR) por padrão

## Como funciona o SSR

- Tudo em `app/` é **Server Component** por padrão: o HTML é gerado no servidor.
- Para interatividade no cliente (hooks, `onClick` etc.), crie um componente e adicione `"use client"` no topo do arquivo.
- Rotas: `app/page.tsx` → `/`, `app/sobre/page.tsx` → `/sobre`.

## Uso

```bash
# Na raiz do repositório
pnpm install
pnpm client:dev
```

Ou dentro de `src/client`:

```bash
cd src/client
pnpm install
pnpm dev
```

Acesse **http://localhost:3000**. A API Fastify deve estar em outra porta (ex.: 4000); configure `NEXT_PUBLIC_API_URL` em `src/client/.env` (copie de `.env.example`).

## Scripts (na raiz)

- `pnpm client:dev` — dev com hot reload (porta 3000)
- `pnpm client:build` — build de produção
- `pnpm client:start` — servir build de produção
