import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

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
    .select("role, full_name, seller_code")
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
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="/seller/dashboard"
              className="text-sm font-medium text-navy-600 hover:text-navy-800"
            >
              Inicio
            </a>
            {profile.role === "admin" && (
              <a
                href="/admin"
                className="text-sm font-medium text-navy-400 hover:text-navy-600"
              >
                Admin
              </a>
            )}
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
