import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Event, EventTicketType } from "@/types/database";
import PublicCheckout from "./checkout-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ seller?: string }>;
}

export default async function PublicEventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { seller: sellerCodeParam } = await searchParams;
  const supabase = createServiceRoleClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!event) {
    notFound();
  }

  const ev = event as Event;

  // Resolve initial seller (from ?seller=XXX) — only attribute if assigned with can_sell
  let initialSeller: { code: string; name: string } | null = null;
  if (sellerCodeParam) {
    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("id, full_name, seller_code, is_active")
      .eq("seller_code", sellerCodeParam)
      .single();

    if (sellerProfile?.is_active) {
      const { data: assignment } = await supabase
        .from("event_sellers")
        .select("can_sell")
        .eq("event_id", ev.id)
        .eq("seller_id", sellerProfile.id)
        .single();

      if (assignment?.can_sell) {
        initialSeller = {
          code: sellerProfile.seller_code!,
          name: sellerProfile.full_name,
        };
      }
    }
  }

  const { data: types } = await supabase
    .from("event_ticket_types")
    .select("*")
    .eq("event_id", ev.id)
    .order("display_order", { ascending: true });

  const ticketTypes = ((types as EventTicketType[] | null) ?? []).filter(
    (t) => !t.is_complimentary,
  );

  // Compute remaining stock per type
  const stockMap: Record<string, number | null> = {};
  for (const t of ticketTypes) {
    if (t.quantity === null) {
      stockMap[t.id] = null; // unlimited
      continue;
    }
    const { count: takenCount } = await supabase
      .from("event_tickets")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type_id", t.id)
      .in("status", ["valid", "used"]);

    const { data: pendingOrders } = await supabase
      .from("event_orders")
      .select("items")
      .eq("event_id", ev.id)
      .in("status", ["pending_review", "awaiting_receipt"]);

    let pending = 0;
    for (const o of pendingOrders || []) {
      const items = o.items as { ticket_type_id: string; quantity: number }[];
      for (const it of items) {
        if (it.ticket_type_id === t.id) pending += it.quantity;
      }
    }
    stockMap[t.id] = Math.max(0, t.quantity - (takenCount || 0) - pending);
  }

  const dateStr = new Date(ev.event_date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-700 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/tickets" className="text-xs text-gold-400 hover:underline">
            ← Volver a eventos
          </Link>
          <h1 className="text-sm font-bold text-gold-400">Bonos Contribución</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Event header */}
        {ev.image_url && (
          <div className="mb-4 aspect-video w-full overflow-hidden rounded-2xl bg-navy-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ev.image_url} alt={ev.name} className="h-full w-full object-cover" />
          </div>
        )}

        <h2 className="text-2xl font-bold text-navy-700">{ev.name}</h2>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-navy-400">
          <span>📅 {dateStr}</span>
          {ev.venue && <span>📍 {ev.venue}</span>}
        </div>

        {ev.description && (
          <div className="mt-4 rounded-2xl border border-navy-100 bg-white p-4 text-sm text-navy-600 shadow-sm">
            <p className="whitespace-pre-line">{ev.description}</p>
          </div>
        )}

        {/* Checkout form */}
        <PublicCheckout
          event={ev}
          ticketTypes={ticketTypes}
          stockMap={stockMap}
          initialSeller={initialSeller}
        />
      </main>

      <footer className="border-t border-navy-100 bg-white px-4 py-6 text-center">
        <p className="text-xs text-navy-400">
          ¿Tenés una pregunta? Contactá a quien te recomendó el evento.
        </p>
      </footer>
    </div>
  );
}
