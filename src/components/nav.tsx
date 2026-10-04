"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export interface NavItem {
  href: string;
  label: string;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // The most specific matching entry is the active one.
  const active = items
    .filter((it) => (it.href === "/" ? pathname === "/" : pathname === it.href || pathname.startsWith(it.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (href: string) => href === active;
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={clsx(
            "whitespace-nowrap rounded px-3 py-2 text-sm font-medium",
            isActive(it.href) ? "bg-accent text-white" : "text-slate-200 hover:bg-white/10",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
