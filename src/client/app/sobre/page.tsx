/**
 * Rota /sobre — também SSR por padrão.
 * URL: /sobre (pasta app/sobre/page.tsx)
 */
export default function SobrePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-4">Sobre</h1>
      <p className="text-zinc-400">
        Esta é uma rota de exemplo. No Next.js App Router, cada{" "}
        <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200">
          page.tsx
        </code>{" "}
        dentro de <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200">app/</code> vira
        uma rota e é renderizada no servidor por padrão.
      </p>
    </div>
  );
}
