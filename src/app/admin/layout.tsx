import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
      <nav className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
          <div className="flex gap-4 text-sm">
            <a href="/admin" className="text-primary-600">
              Campañas
            </a>
            <a href="/admin/sellers" className="text-gray-600">
              Vendedores
            </a>
            <a href="/admin/reports" className="text-gray-600">
              Reportes
            </a>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
