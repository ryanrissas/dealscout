"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutGrid, Table2, KanbanSquare, Bell, Bookmark, Settings2, GitCompare, LogOut,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/deals", label: "Deals", icon: Table2 },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/saved-searches", label: "Saved searches", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function Sidebar({ name, role, unread }: { name: string; role: string; unread: number }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-ink text-paper">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="font-serif text-xl font-semibold leading-none">DealScout</div>
        <div className="eyebrow mt-1.5 text-paper/50">Acquisitions ledger</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`mx-2 mb-0.5 flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm no-underline transition-colors ${
                active ? "bg-paper text-ink font-medium" : "text-paper/75 hover:bg-white/10 hover:text-paper"
              }`}
            >
              <Icon size={15} strokeWidth={2} />
              <span className="flex-1">{label}</span>
              {href === "/alerts" && unread > 0 && (
                <span className="mono rounded-sm bg-deal-amber px-1.5 text-[11px] font-bold text-white">{unread}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="text-sm font-medium">{name}</div>
        <div className="eyebrow mt-0.5 text-paper/50">{role.toLowerCase()}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 flex w-full items-center gap-2 rounded-sm border border-white/15 px-3 py-1.5 text-xs text-paper/75 hover:bg-white/10"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );
}
