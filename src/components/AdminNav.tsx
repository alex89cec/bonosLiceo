"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const navItems = [
  {
    href: "/seller/dashboard",
    label: "Inicio",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/admin",
    label: "Campañas",
    match: ["/admin", "/admin/campaigns"],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/admin/groups",
    label: "Grupos",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/sellers",
    label: "Vendedores",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: "/admin/reports",
    label: "Reportes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, item: (typeof navItems)[0]) {
  if (item.match) {
    // Exact match for items with explicit match paths
    return item.match.some((m) => pathname === m);
  }
  if (item.href === "/seller/dashboard") {
    return pathname === "/seller/dashboard";
  }
  return pathname.startsWith(item.href);
}

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    document.cookie = "remember_me=; path=/; max-age=0; SameSite=Lax; Secure";
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden border-b border-navy-100 bg-white px-4 py-3 md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-navy-700 text-white"
                      : "text-navy-500 hover:bg-navy-50 hover:text-navy-700"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg px-3 py-2 text-sm font-medium text-navy-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            {loggingOut ? "..." : "Salir"}
          </button>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-navy-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-stretch justify-around">
          {navItems.map((item) => {
            const active = isActive(pathname, item);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-navy-700"
                    : "text-navy-400"
                }`}
              >
                <span className={`${active ? "text-gold-500" : ""}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-b bg-gold-500" />
                )}
              </a>
            );
          })}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-navy-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{loggingOut ? "..." : "Salir"}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
