import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import SellersList, { type ProfileWithGroup } from "./sellers-list";

export default async function AdminSellersPage() {
  const supabase = await createServerSupabaseClient();

  // Single query: fetch all profiles (admins + sellers) with group join
  const { data } = await supabase
    .from("profiles")
    .select("*, seller_group:group_id(id, name, color)")
    .order("full_name", { ascending: true });

  const profiles = (data as ProfileWithGroup[] | null) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Vendedores</h2>
        <Link href="/admin/sellers/new" className="btn-primary">
          + Nuevo vendedor
        </Link>
      </div>

      <SellersList profiles={profiles} />
    </div>
  );
}
