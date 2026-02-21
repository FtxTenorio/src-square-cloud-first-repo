import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Square Cloud",
  description: "Página principal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 px-6 py-4">
          <nav className="flex gap-6">
            <a href="/" className="text-zinc-300 hover:text-white transition-colors">
              Home
            </a>
            <a href="/settings" className="text-zinc-300 hover:text-white transition-colors">
              Settings
            </a>
          </nav>
        </header>
        <main className="px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
