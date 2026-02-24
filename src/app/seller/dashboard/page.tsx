import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReservationCard, {
  type ReservationCardData,
} from "@/components/ReservationCard";
import BuyerGroupCard from "@/components/BuyerGroupCard";

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

  // Get total sales amount from confirmed/completed payments
  const { data: sellerPayments } = await supabase
    .from("reservations")
    .select("payments (amount, status)")
    .eq("seller_id", user.id);

  let totalSales = 0;
  for (const r of sellerPayments || []) {
    const payments = r.payments as unknown as
      | { amount: number; status: string }[]
      | null;
    for (const p of payments || []) {
      totalSales += p.amount || 0;
    }
  }

  // Get campaigns: admins see ALL active campaigns, sellers see only assigned ones
  let campaigns: {
    id: string;
    name: string;
    slug: string;
    status: string;
    ticket_price: number;
  }[] = [];

  if (profile.role === "admin") {
    // Admins can sell from any campaign
    const { data: allCampaigns } = await supabase
      .from("campaigns")
      .select("id, name, slug, status, ticket_price")
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false });

    campaigns = allCampaigns || [];
  } else {
    // Sellers only see assigned campaigns
    const { data: assignments } = await supabase
      .from("campaign_sellers")
      .select(
        `
        campaign_id,
        campaigns:campaign_id (id, name, slug, status, ticket_price)
      `,
      )
      .eq("seller_id", user.id);

    campaigns =
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
  }

  // Get recent reservations with full details including payments and installments
  const { data: reservations } = await supabase
    .from("reservations")
    .select(
      `
      id,
      status,
      created_at,
      tickets:ticket_id (number),
      buyers:buyer_id (email, full_name),
      campaigns:campaign_id (name),
      payments (id, amount, payment_mode, status, installments (id, number, amount, due_date, paid_at, status))
    `,
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Transform raw data into typed ReservationCardData[]
  const cardData: ReservationCardData[] = (reservations || []).map(
    (r: Record<string, unknown>) => {
      const ticket = r.tickets as Record<string, unknown> | null;
      const buyer = r.buyers as Record<string, unknown> | null;
      const campaign = r.campaigns as Record<string, unknown> | null;
      const payments = r.payments as Record<string, unknown>[] | null;
      const payment = payments?.[0];
      const installments =
        (payment?.installments as Record<string, unknown>[] | null) || [];

      return {
        id: r.id as string,
        status: r.status as string,
        created_at: r.created_at as string,
        ticket_number: (ticket?.number as string) || "------",
        buyer_email: (buyer?.email as string) || "",
        buyer_name: (buyer?.full_name as string) || null,
        campaign_name: (campaign?.name as string) || "",
        payment: {
          id: (payment?.id as string) || "",
          amount: (payment?.amount as number) || 0,
          payment_mode: (payment?.payment_mode as string) || "full_payment",
          status: (payment?.status as string) || "pending",
          installments: installments.map((inst) => ({
            id: inst.id as string,
            number: inst.number as number,
            amount: inst.amount as number,
            due_date: inst.due_date as string,
            paid_at: (inst.paid_at as string) || null,
            status: inst.status as string,
          })),
        },
      };
    },
  );

  return (
    <div className="space-y-4">
      {/* Seller info */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-navy-700">
              {profile.full_name}
            </p>
            {profile.seller_code && (
              <p className="mt-0.5 text-sm text-navy-400">
                Código de venta:{" "}
                <span className="font-mono font-semibold text-blue-600">
                  {profile.seller_code}
                </span>
              </p>
            )}
            <p className="mt-0.5 truncate text-sm text-navy-400">
              {user.email}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-navy-400">Total vendido</p>
            <p className="text-xl font-bold text-green-600">${totalSales}</p>
          </div>
        </div>
      </div>

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

      {/* Recent reservations — grouped by buyer */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-navy-400">
          Ventas recientes
        </h2>
        <div className="space-y-2">
          {(() => {
            // Group reservations by buyer_email
            const grouped = new Map<string, ReservationCardData[]>();
            for (const r of cardData) {
              const key = r.buyer_email || r.id; // fallback to id if no email
              const list = grouped.get(key) || [];
              list.push(r);
              grouped.set(key, list);
            }

            const elements: React.ReactNode[] = [];
            for (const [email, group] of grouped) {
              if (group.length === 1) {
                elements.push(
                  <ReservationCard
                    key={group[0].id}
                    reservation={group[0]}
                  />,
                );
              } else {
                elements.push(
                  <BuyerGroupCard
                    key={email}
                    buyerEmail={email}
                    reservations={group}
                  />,
                );
              }
            }
            return elements;
          })()}

          {cardData.length === 0 && (
            <p className="py-8 text-center text-sm text-navy-400">
              Sin ventas aún
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
