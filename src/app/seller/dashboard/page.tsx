import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ReservationCardData } from "@/components/ReservationCard";
import type { EventOrderCardData } from "@/components/EventOrderCard";
import DashboardTabs from "@/components/DashboardTabs";

export default async function SellerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // ── Profile ──
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*, seller_group:group_id(name)")
    .eq("id", user.id)
    .single();

  if (!profileData) return null;

  const profile = profileData;
  const groupName = (profileData.seller_group as { name: string } | null)
    ?.name;

  // ── BONOS DATA ──
  // Stats: ticket counts (only from active campaigns)
  const { data: bonosTickets } = await supabase
    .from("tickets")
    .select("status, campaigns:campaign_id !inner (status)")
    .eq("seller_id", user.id)
    .eq("campaigns.status", "active");

  const bonosCounts = {
    reserved: bonosTickets?.filter((t) => t.status === "reserved").length || 0,
    sold: bonosTickets?.filter((t) => t.status === "sold").length || 0,
  };

  // Total bonos sales amount
  const { data: bonosSellerPayments } = await supabase
    .from("reservations")
    .select("payments (amount, status), campaigns:campaign_id !inner (status)")
    .eq("seller_id", user.id)
    .eq("campaigns.status", "active");

  let bonosTotalAmount = 0;
  for (const r of bonosSellerPayments || []) {
    const payments = r.payments as unknown as
      | { amount: number; status: string }[]
      | null;
    for (const p of payments || []) {
      bonosTotalAmount += p.amount || 0;
    }
  }

  // Bonos campaigns
  let bonosCampaigns: {
    id: string;
    name: string;
    slug: string;
    status: string;
    ticket_price: number;
  }[] = [];
  if (profile.role === "admin") {
    const { data: allCampaigns } = await supabase
      .from("campaigns")
      .select("id, name, slug, status, ticket_price")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    bonosCampaigns = allCampaigns || [];
  } else {
    const { data: assignments } = await supabase
      .from("campaign_sellers")
      .select(
        "campaign_id, campaigns:campaign_id !inner (id, name, slug, status, ticket_price)",
      )
      .eq("seller_id", user.id)
      .eq("campaigns.status", "active");

    bonosCampaigns =
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

  // Bonos recent reservations
  const { data: reservations } = await supabase
    .from("reservations")
    .select(
      `
      id,
      status,
      created_at,
      tickets:ticket_id (number),
      buyers:buyer_id (email, full_name),
      campaigns:campaign_id !inner (name, status),
      payments (id, amount, payment_mode, status, installments (id, number, amount, due_date, paid_at, status))
    `,
    )
    .eq("seller_id", user.id)
    .eq("campaigns.status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  const bonosReservations: ReservationCardData[] = (reservations || []).map(
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

  // ── EVENTS DATA ──
  // Assigned events
  const { data: eventAssignments } = await supabase
    .from("event_sellers")
    .select(
      "can_sell, can_scan, events:event_id (id, name, slug, status, event_date, venue)",
    )
    .eq("seller_id", user.id);

  const baseEvents = (eventAssignments || [])
    .filter((a) => a.can_sell || a.can_scan)
    .map((a) => ({
      ...(a.events as unknown as {
        id: string;
        name: string;
        slug: string;
        status: string;
        event_date: string;
        venue: string | null;
      }),
      can_sell: a.can_sell,
      can_scan: a.can_scan,
    }))
    .filter(
      (e) => e && e.id && (e.status === "active" || e.status === "draft"),
    );

  // Order counts per event for this seller
  const eventIds = baseEvents.map((e) => e.id);
  const orderCountsByEvent: Record<
    string,
    { approved: number; pending: number }
  > = {};
  if (eventIds.length > 0) {
    const { data: countsRows } = await supabase
      .from("event_orders")
      .select("event_id, status")
      .in("event_id", eventIds)
      .eq("seller_id", user.id);

    for (const row of countsRows || []) {
      const ev = row.event_id as string;
      if (!orderCountsByEvent[ev])
        orderCountsByEvent[ev] = { approved: 0, pending: 0 };
      if (row.status === "approved" || row.status === "complimentary")
        orderCountsByEvent[ev].approved++;
      else if (
        row.status === "pending_review" ||
        row.status === "awaiting_receipt"
      )
        orderCountsByEvent[ev].pending++;
    }
  }

  const events = baseEvents.map((e) => {
    const c = orderCountsByEvent[e.id] || { approved: 0, pending: 0 };
    return {
      ...e,
      approved_count: c.approved,
      pending_count: c.pending,
    };
  });

  // All event orders by this seller (for stats + recent feed)
  const { data: ownEventOrdersRaw } = await supabase
    .from("event_orders")
    .select(
      `
      id, status, total_amount, payment_method, receipt_filename,
      rejection_reason, notes, created_at, items,
      events:event_id (name),
      buyers:buyer_id (email, full_name)
    `,
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const ownEventOrders: EventOrderCardData[] = (
    ownEventOrdersRaw || []
  ).map((o: Record<string, unknown>) => {
    const ev = o.events as Record<string, unknown> | null;
    const buyer = o.buyers as Record<string, unknown> | null;
    return {
      id: o.id as string,
      status: o.status as string,
      total_amount: (o.total_amount as number) || 0,
      payment_method: (o.payment_method as string) || "transferencia",
      receipt_filename: (o.receipt_filename as string) || null,
      rejection_reason: (o.rejection_reason as string) || null,
      notes: (o.notes as string) || null,
      created_at: o.created_at as string,
      items:
        (o.items as { name: string; quantity: number; unit_price: number }[]) ||
        [],
      event_name: (ev?.name as string) || "",
      buyer_email: (buyer?.email as string) || "",
      buyer_name: (buyer?.full_name as string) || null,
    };
  });

  // Events stats from order data
  let approvedOrdersCount = 0;
  let pendingOrdersCount = 0;
  let eventsTotalAmount = 0;
  for (const o of ownEventOrders) {
    if (o.status === "approved" || o.status === "complimentary") {
      approvedOrdersCount++;
      // Only count amount for actually-paid (non-complimentary) approved orders
      if (o.status === "approved") {
        eventsTotalAmount += o.total_amount;
      }
    } else if (
      o.status === "pending_review" ||
      o.status === "awaiting_receipt"
    ) {
      pendingOrdersCount++;
    }
  }

  return (
    <div className="space-y-4">
      {/* Profile card (shared across all tabs) */}
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
            {groupName && (
              <p className="mt-0.5 text-sm text-navy-400">
                Grupo:{" "}
                <span className="font-semibold text-blue-600">{groupName}</span>
              </p>
            )}
            <p className="mt-0.5 truncate text-sm text-navy-400">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <DashboardTabs
        bonosCampaigns={bonosCampaigns}
        bonosStats={{
          reserved: bonosCounts.reserved,
          sold: bonosCounts.sold,
          total_amount: bonosTotalAmount,
        }}
        bonosReservations={bonosReservations}
        events={events}
        eventsStats={{
          approved_orders: approvedOrdersCount,
          pending_orders: pendingOrdersCount,
          total_amount: eventsTotalAmount,
        }}
        eventOrders={ownEventOrders}
      />
    </div>
  );
}
