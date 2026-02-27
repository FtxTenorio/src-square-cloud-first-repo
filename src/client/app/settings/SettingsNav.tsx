"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "settings-sidebar-visible";

const sections = [
  {
    title: "Comandos",
    description: "Gerencie os slash commands, escopo (global/guild), sync e deploy no Discord.",
    items: [{ href: "/settings/commands", label: "Commands" }],
  },
  {
    title: "Por usuário",
    description: "Preferências que cada usuário pode configurar (por Discord ID).",
    items: [{ href: "/settings/preferences", label: "Minhas preferências" }],
  },
  {
    title: "Sistema",
    description: "Configurações do servidor (guild). Requer permissão ou chave de admin.",
    items: [{ href: "/settings/server", label: "Servidor" }],
  },
  {
    title: "Admin",
    description: "Configurações globais. Apenas administradores.",
    items: [{ href: "/settings/admin", label: "Configurações globais" }],
  },
];

export default function SettingsNav() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setVisible(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  const toggle = () => {
    setVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (!visible) {
    return (
      <aside className="w-12 shrink-0 border-r border-zinc-800 bg-zinc-900/30 flex flex-col items-center py-4">
        <button
          type="button"
          onClick={toggle}
          className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          title="Mostrar menu"
          aria-label="Mostrar menu lateral"
        >
          <span className="text-lg" aria-hidden>›</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-900/30 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Settings
        </h2>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          title="Ocultar menu"
          aria-label="Ocultar menu lateral"
        >
          <span className="text-sm font-medium" aria-hidden>‹</span>
        </button>
      </div>
      <nav className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              {section.title}
            </p>
            {section.description && (
              <p className="text-xs text-zinc-600 mb-2 max-w-[200px]">
                {section.description}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {section.items.map(({ href, label }) => {
                const isActive =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={
                      isActive
                        ? "rounded-md px-3 py-2 text-sm bg-zinc-700 text-white"
                        : "rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
