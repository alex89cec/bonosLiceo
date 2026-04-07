"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function SellerNav({ isAdmin }: { isAdmin: boolean }) {
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

  const isDashboard = pathname === "/seller/dashboard";
  const isSelling = pathname.startsWith("/seller/sell");

  return (
    <>
      {/* Top bar */}
      <nav className="border-b border-navy-100 bg-white px-4 py-2.5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* Left: Home */}
          <a
            href="/seller/dashboard"
            title="Inicio"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isDashboard || isSelling
                ? "text-navy-700"
                : "text-navy-400 hover:text-navy-700"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="hidden sm:inline">Inicio</span>
          </a>

          {/* Center: Title */}
          <h1 className="text-base font-bold text-navy-700">Panel Vendedor</h1>

          {/* Right: Admin + Logout */}
          <div className="flex items-center gap-1">
            {isAdmin && (
              <a
                href="/admin"
                title="Admin"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Admin</span>
              </a>
            )}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Salir"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-navy-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">{loggingOut ? "..." : "Salir"}</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
