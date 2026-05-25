"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `remember_me=; path=/; max-age=0; SameSite=Lax${secure}`;
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="whitespace-nowrap text-sm font-medium text-navy-400 transition-colors hover:text-red-500"
    >
      {loading ? "Saliendo..." : "Salir"}
    </button>
  );
}
