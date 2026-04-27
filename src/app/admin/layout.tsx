import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";

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

  // Allow admins, plus sellers who are validators (is_approver=true) — they
  // need access to /admin/orders to approve. Non-orders admin pages still
  // require admin role and are gated at the API level.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, is_approver")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isValidator = profile?.is_approver === true;
  const allowed = profile?.is_active && (isAdmin || isValidator);

  if (!profile || !allowed) {
    redirect("/seller/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav isAdmin={isAdmin} isValidator={isValidator} />
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
