import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SellerEventsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Get events where user is assigned with can_sell=true
  const { data: assignments } = await supabase
    .from("event_sellers")
    .select(
      `
      can_sell,
      can_scan,
      events:event_id (id, name, slug, status, event_date, venue, image_url)
    `,
    )
    .eq("seller_id", user.id)
    .eq("can_sell", true);

  // Filter to active or draft events
  const events = (assignments || [])
    .map(
      (a) =>
        a.events as unknown as {
          id: string;
          name: string;
          slug: string;
          status: string;
          event_date: string;
          venue: string | null;
          image_url: string | null;
        } | null,
    )
    .filter((e): e is NonNullable<typeof e> => e !== null && (e.status === "active" || e.status === "draft"));

  // Sales stats per event for this seller
  const eventIds = events.map((e) => e.id);
  const salesMap: Record<string, { total: number; pending: number; approved: number }> = {};
  if (eventIds.length > 0) {
    const { data: orders } = await supabase
      .from("event_orders")
      .select("event_id, status")
      .in("event_id", eventIds)
      .eq("seller_id", user.id);

    for (const o of orders || []) {
      if (!salesMap[o.event_id]) {
        salesMap[o.event_id] = { total: 0, pending: 0, approved: 0 };
      }
      salesMap[o.event_id].total++;
      if (o.status === "pending_review") salesMap[o.event_id].pending++;
      if (o.status === "approved" || o.status === "complimentary")
        salesMap[o.event_id].approved++;
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Eventos para vender</h2>

      {events.length === 0 ? (
        <p className="py-12 text-center text-sm text-navy-400">
          No tenés eventos asignados aún.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const stats = salesMap[e.id] || { total: 0, pending: 0, approved: 0 };
            const dateStr = new Date(e.event_date).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Link
                key={e.id}
                href={`/seller/events/${e.slug}/sell`}
                className="card block transition hover:border-gold-400 hover:bg-gold-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-navy-700">{e.name}</h3>
                    <p className="mt-1 text-xs text-navy-400">
                      📅 {dateStr}
                      {e.venue && <span className="ml-2">📍 {e.venue}</span>}
                    </p>
                    {stats.total > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {stats.approved > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                            {stats.approved} aprobadas
                          </span>
                        )}
                        {stats.pending > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                            {stats.pending} pendientes
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-800">
                    Vender
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
