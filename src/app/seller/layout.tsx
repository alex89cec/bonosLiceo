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

  // Admins always have scanner access. Sellers only if assigned with
  // can_scan=true on at least one event.
  let canScan = profile.role === "admin";
  if (!canScan) {
    const { count } = await supabase
      .from("event_sellers")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("can_scan", true);
    canScan = (count || 0) > 0;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SellerNav isAdmin={profile.role === "admin"} canScan={canScan} />
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
