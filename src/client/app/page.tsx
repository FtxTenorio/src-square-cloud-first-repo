/**
 * Página inicial — renderizada no servidor (SSR) por padrão no Next.js App Router.
 * Componentes em app/ são Server Components; use "use client" no topo para Client Component.
 */
export default async function HomePage() {
  // Exemplo: buscar dados no servidor (SSR) — pode chamar sua API Fastify
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  let hello = { hello: "world", timestamp: "" };
  try {
    const res = await fetch(`${apiUrl}/`, { next: { revalidate: 10 } });
    hello = (await res.json()) as { hello: string; timestamp: string };
  } catch {
    // fallback se a API não estiver rodando
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-4">
        Bem-vindo ao Square Cloud
      </h1>
      <p className="text-zinc-400 mb-6">
        Esta página é renderizada no servidor (SSR). Rotas ficam em{" "}
        <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200">
          app/
        </code>
        : cada pasta vira uma rota.
      </p>
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">
          Dados da API (SSR)
        </h2>
        <pre className="text-sm text-emerald-400 overflow-x-auto">
          {JSON.stringify(hello, null, 2)}
        </pre>
      </section>
    </div>
  );
}
