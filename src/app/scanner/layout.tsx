import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ScannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/scanner");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) redirect("/login");

  // Sellers without can_scan on at least one event should not be here
  if (profile.role !== "admin") {
    const { count } = await supabase
      .from("event_sellers")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("can_scan", true);
    if (!count || count === 0) {
      redirect("/seller/dashboard");
    }
  }

  return <div className="min-h-screen bg-navy-900 text-white">{children}</div>;
}
