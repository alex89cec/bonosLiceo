import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SellerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth is handled by layout, but just in case
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // Get ticket stats for this seller (tickets they've sold/reserved)
  const { data: stats } = await supabase
    .from("tickets")
    .select("status")
    .eq("seller_id", user.id);

  const counts = {
    reserved: stats?.filter((t) => t.status === "reserved").length || 0,
    sold: stats?.filter((t) => t.status === "sold").length || 0,
  };

  // Get campaigns assigned to this seller
  const { data: assignments } = await supabase
    .from("campaign_sellers")
    .select(
      `
      campaign_id,
      campaigns:campaign_id (id, name, slug, status, ticket_price)
    `,
    )
    .eq("seller_id", user.id);

  const campaigns =
    assignments
      ?.map(
        (a) =>
          a.campaigns as unknown as {
            id: string;
            name: string;
            slug: string;
            status: string;
            ticket_price: number;
          },
      )
      .filter(Boolean) || [];

  // Get recent reservations
  const { data: reservations } = await supabase
    .from("reservations")
    .select(
      `
      id,
      status,
      created_at,
      tickets:ticket_id (number),
      buyers:buyer_id (email)
    `,
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="card text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {counts.reserved}
          </p>
          <p className="text-xs text-navy-400">Reservados</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{counts.sold}</p>
          <p className="text-xs text-navy-400">Vendidos</p>
        </div>
      </div>

      {/* Campaigns to sell */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Mis campañas
        </h2>
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <a
              key={campaign.id}
              href={
                campaign.status === "active"
                  ? `/seller/sell/${campaign.slug}`
                  : "#"
              }
              className={`card flex items-center justify-between transition-all ${
                campaign.status === "active"
                  ? "hover:border-gold-400 hover:bg-gold-50"
                  : "opacity-50"
              }`}
            >
              <div>
                <p className="font-semibold text-navy-700">{campaign.name}</p>
                <p className="text-sm text-navy-400">
                  ${campaign.ticket_price}
                </p>
              </div>
              {campaign.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-800">
                  Vender
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {campaign.status}
                </span>
              )}
            </a>
          ))}

          {campaigns.length === 0 && (
            <p className="py-8 text-center text-sm text-navy-400">
              No tienes campañas asignadas
            </p>
          )}
        </div>
      </div>

      {/* Seller Code */}
      {profile.seller_code && (
        <div className="card">
          <p className="text-sm font-semibold text-navy-700">Tu código</p>
          <p className="mt-1 font-mono text-sm text-gold-600">
            {profile.seller_code}
          </p>
        </div>
      )}

      {/* Recent reservations */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Ventas recientes
        </h2>
        <div className="space-y-2">
          {reservations?.map((r: Record<string, unknown>) => (
            <div
              key={r.id as string}
              className="card flex items-center justify-between"
            >
              <div>
                <p className="font-mono text-sm font-bold">
                  #
                  {
                    (r.tickets as Record<string, unknown>)
                      ?.number as string
                  }
                </p>
                <p className="text-xs text-navy-400">
                  {
                    (r.buyers as Record<string, unknown>)
                      ?.email as string
                  }
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  r.status === "active"
                    ? "bg-yellow-100 text-yellow-700"
                    : r.status === "confirmed"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {r.status === "active"
                  ? "Pendiente"
                  : r.status === "confirmed"
                    ? "Confirmado"
                    : (r.status as string)}
              </span>
            </div>
          ))}

          {!reservations?.length && (
            <p className="py-8 text-center text-sm text-navy-400">
              Sin ventas aún
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
