import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export default async function AdminSellersPage() {
  const supabase = await createServerSupabaseClient();

  // Fetch both admins and sellers
  const { data: admins } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .order("full_name", { ascending: true });

  const { data: sellers } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "seller")
    .order("created_at", { ascending: false });

  const adminList = (admins as Profile[] | null) ?? [];
  const sellerList = (sellers as Profile[] | null) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Vendedores</h2>
        <Link href="/admin/sellers/new" className="btn-primary">
          + Nuevo vendedor
        </Link>
      </div>

      {/* Admin users */}
      {adminList.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
            Administradores
          </h3>
          <div className="space-y-3">
            {adminList.map((admin) => (
              <Link
                key={admin.id}
                href={`/admin/sellers/${admin.id}`}
                className="card block transition-all hover:border-gold-400 hover:bg-gold-50"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{admin.full_name}</h3>
                      <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-600">
                        Admin
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{admin.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-navy-50 px-3 py-1 font-mono text-sm font-semibold text-navy-600">
                      {admin.seller_code || "—"}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sellers section header */}
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
        Vendedores
      </h3>

      {sellerList.length > 0 ? (
        <div className="space-y-3">
          {sellerList.map((seller) => (
            <Link
              key={seller.id}
              href={`/admin/sellers/${seller.id}`}
              className="card block transition-all hover:border-gold-400 hover:bg-gold-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{seller.full_name}</h3>
                    {!seller.is_active && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                        Inactivo
                      </span>
                    )}
                    {seller.must_change_password && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{seller.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-navy-50 px-3 py-1 font-mono text-sm font-semibold text-navy-600">
                    {seller.seller_code}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
                <span>
                  Creado:{" "}
                  {new Date(seller.created_at).toLocaleDateString("es")}
                </span>
                {seller.phone && <span>Tel: {seller.phone}</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-gray-500">
          No hay vendedores. Agrega el primero.
        </p>
      )}
    </div>
  );
}
