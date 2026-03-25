import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import SellerNav from "@/components/SellerNav";

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
      <SellerNav isAdmin={profile.role === "admin"} />
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
