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
      <nav className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <h1 className="shrink-0 text-lg font-bold text-gray-900">Admin</h1>
          <div className="flex flex-1 items-center justify-end gap-3 text-sm">
            <a href="/admin" className="whitespace-nowrap text-primary-600">
              Campañas
            </a>
            <a href="/admin/sellers" className="whitespace-nowrap text-gray-600">
              Vendedores
            </a>
            <a href="/admin/reports" className="whitespace-nowrap text-gray-600">
              Reportes
            </a>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
