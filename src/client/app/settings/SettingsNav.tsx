"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [{ href: "/settings/commands", label: "Commands" }];

export default function SettingsNav() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900/30 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">
        Settings
      </h2>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
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
      </nav>
    </aside>
  );
}
