import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = rateLimit(`mis-entradas:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intentá en un rato." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const service = createServiceRoleClient();

    const { data: buyer } = await service
      .from("buyers")
      .select("id, email, full_name")
      .eq("email", email)
      .maybeSingle();

    if (!buyer) {
      return NextResponse.json({ tickets: [], orders: [] });
    }

    // Fetch tickets with type + bundle info. Components (rows with
    // parent_bundle_type_id set) are hidden from the buyer — their QR
    // isn't useful here; the aggregator's QR covers the whole pack.
    const { data: ticketsRaw } = await service
      .from("event_tickets")
      .select(
        `
        id, qr_token, status, amount_paid, entered_at, parent_bundle_type_id,
        events:event_id (id, name, slug, event_date, venue, image_url),
        ticket_type:ticket_type_id (id, name, color, bundle_items),
        parent_bundle:parent_bundle_type_id (id, name)
      `,
      )
      .eq("buyer_id", buyer.id)
      .in("status", ["valid", "used"])
      .order("created_at", { ascending: false });

    // Resolve component-type names so we can render "2× General + 2× Menor".
    const componentTypeIds = new Set<string>();
    for (const t of ticketsRaw ?? []) {
      const tt = t.ticket_type as unknown as {
        bundle_items: { ticket_type_id: string }[] | null;
      } | null;
      if (tt?.bundle_items) {
        for (const bi of tt.bundle_items) componentTypeIds.add(bi.ticket_type_id);
      }
    }
    let typeNameById = new Map<string, string>();
    if (componentTypeIds.size > 0) {
      const { data: compTypes } = await service
        .from("event_ticket_types")
        .select("id, name")
        .in("id", [...componentTypeIds]);
      typeNameById = new Map(
        (compTypes ?? []).map((t) => [t.id as string, t.name as string]),
      );
    }

    const tickets = (ticketsRaw ?? [])
      .filter((t) => !t.parent_bundle_type_id)
      .map((t) => {
        const tt = t.ticket_type as unknown as {
          id: string;
          name: string;
          color: string | null;
          bundle_items: { ticket_type_id: string; quantity: number }[] | null;
        } | null;
        const isAggregator =
          Array.isArray(tt?.bundle_items) && tt!.bundle_items!.length > 0;
        const bundleSize = isAggregator
          ? tt!.bundle_items!.reduce((s, c) => s + c.quantity, 0)
          : 1;
        const bundleLabel = isAggregator
          ? tt!
              .bundle_items!.map(
                (bi) =>
                  `${bi.quantity}× ${typeNameById.get(bi.ticket_type_id) || "?"}`,
              )
              .join(" + ")
          : null;
        return {
          ...t,
          is_aggregator: isAggregator,
          bundle_size: bundleSize,
          bundle_label: bundleLabel,
        };
      });

    // Also: pending/awaiting orders (not yet approved → no tickets generated)
    const { data: pendingOrders } = await service
      .from("event_orders")
      .select(
        `
        id, status, total_amount, items, payment_method, created_at, rejection_reason,
        events:event_id (id, name, slug, event_date, venue)
      `,
      )
      .eq("buyer_id", buyer.id)
      .in("status", ["pending_review", "awaiting_receipt", "rejected"])
      .order("created_at", { ascending: false });

    return NextResponse.json({
      buyer: { email: buyer.email, name: buyer.full_name },
      tickets: tickets || [],
      orders: pendingOrders || [],
    });
  } catch (err) {
    console.error("mis-entradas error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
