import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  // Check admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/seller/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="overflow-x-auto border-b border-navy-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-nowrap items-center gap-3">
          <a href="/seller/dashboard" className="shrink-0 text-sm font-medium text-navy-600 hover:text-navy-800">
            Inicio
          </a>
          <a href="/admin" className="shrink-0 text-sm font-medium text-navy-600 hover:text-navy-800">
            Campañas
          </a>
          <a href="/admin/sellers" className="shrink-0 text-sm font-medium text-navy-400 hover:text-navy-600">
            Vendedores
          </a>
          <a href="/admin/reports" className="shrink-0 text-sm font-medium text-navy-400 hover:text-navy-600">
            Reportes
          </a>
          <LogoutButton />
        </div>
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
