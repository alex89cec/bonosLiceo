import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/seller/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["seller", "admin"].includes(profile.role)) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-navy-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-navy-700">
              Panel Vendedor
            </h1>
            <p className="text-xs text-navy-400">{profile.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            {profile.role === "admin" && (
              <a
                href="/admin"
                className="text-sm font-medium text-navy-400 hover:text-navy-600"
              >
                Admin
              </a>
            )}
            <a
              href="/seller/dashboard"
              className="text-sm font-medium text-navy-600 hover:text-navy-800"
            >
              Inicio
            </a>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
