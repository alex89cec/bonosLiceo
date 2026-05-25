import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateQrToken } from "@/lib/qr-token";
import { sendApprovedTicketsEmail } from "@/lib/email";

interface BundleComponent {
  ticket_type_id: string;
  quantity: number;
}

interface OrderItemSnapshot {
  ticket_type_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  is_bundle?: boolean;
  bundle_items?: BundleComponent[] | null;
}

interface TicketRow {
  id: string;
  event_id: string;
  ticket_type_id: string;
  buyer_id: string;
  seller_id: string | null;
  order_id: string;
  qr_token: string;
  amount_paid: number;
  is_complimentary: boolean;
  parent_bundle_type_id: string | null;
  status: "valid";
}

/**
 * Generate event_tickets rows for an approved/complimentary order.
 *
 * Bundle layout: each bundle item produces 1 "aggregator" ticket of
 * the bundle type plus N "component" tickets (one per slot in the
 * bundle, e.g. 2 Adulto + 2 Menor for a Grupo Familiar (2A + 2M)).
 *
 *   • The aggregator is the QR the buyer receives. Scanning it admits
 *     the whole pack at once (the scan endpoint cascades `used` to the
 *     component rows). amount_paid = item.unit_price.
 *   • Components carry parent_bundle_type_id = bundle type id and
 *     amount_paid = 0 — they exist for headcount and per-type stats,
 *     not as QRs the buyer presents.
 *
 * Idempotent: if tickets already exist for the order, returns existing.
 */
export async function generateTicketsForOrder(
  orderId: string,
): Promise<
  | { success: true; count: number; ticketIds: string[] }
  | { success: false; error: string }
> {
  const service = createServiceRoleClient();

  const { data: order, error: orderErr } = await service
    .from("event_orders")
    .select("id, event_id, buyer_id, seller_id, items, status, payment_method")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return { success: false, error: "Order not found" };
  }
  if (!["approved", "complimentary"].includes(order.status)) {
    return { success: false, error: "Order not in approvable state" };
  }

  // Idempotency: if tickets already generated, return them
  const { data: existing } = await service
    .from("event_tickets")
    .select("id")
    .eq("order_id", orderId);

  if (existing && existing.length > 0) {
    return {
      success: true,
      count: existing.length,
      ticketIds: existing.map((t) => t.id),
    };
  }

  const items = order.items as OrderItemSnapshot[];
  const isComplimentary = order.payment_method === "cortesia";

  const rows: TicketRow[] = [];

  for (const item of items) {
    const isBundle = item.is_bundle && item.bundle_items && item.bundle_items.length > 0;

    if (isBundle) {
      // For each ordered pack: 1 aggregator (the QR the buyer gets) +
      // N components (parent_bundle_type_id set, no buyer-facing QR).
      for (let bIdx = 0; bIdx < item.quantity; bIdx++) {
        const aggregatorId = crypto.randomUUID();
        rows.push({
          id: aggregatorId,
          event_id: order.event_id,
          ticket_type_id: item.ticket_type_id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          order_id: order.id,
          qr_token: generateQrToken(aggregatorId),
          amount_paid: item.unit_price,
          is_complimentary: isComplimentary,
          parent_bundle_type_id: null,
          status: "valid",
        });

        for (const component of item.bundle_items!) {
          for (let i = 0; i < component.quantity; i++) {
            const id = crypto.randomUUID();
            rows.push({
              id,
              event_id: order.event_id,
              ticket_type_id: component.ticket_type_id,
              buyer_id: order.buyer_id,
              seller_id: order.seller_id,
              order_id: order.id,
              qr_token: generateQrToken(id),
              amount_paid: 0,
              is_complimentary: isComplimentary,
              parent_bundle_type_id: item.ticket_type_id,
              status: "valid",
            });
          }
        }
      }
    } else {
      // Regular type: 1 ticket per ordered quantity
      for (let i = 0; i < item.quantity; i++) {
        const id = crypto.randomUUID();
        rows.push({
          id,
          event_id: order.event_id,
          ticket_type_id: item.ticket_type_id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          order_id: order.id,
          qr_token: generateQrToken(id),
          amount_paid: item.unit_price,
          is_complimentary: isComplimentary,
          parent_bundle_type_id: null,
          status: "valid",
        });
      }
    }
  }

  const { error } = await service.from("event_tickets").insert(rows);
  if (error) {
    console.error("Tickets insert error:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    count: rows.length,
    ticketIds: rows.map((r) => r.id),
  };
}

/**
 * Fetch all data needed and send the approved-tickets email to the buyer.
 * Safe to call multiple times (resend).
 */
export async function sendOrderTicketsEmail(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  const service = createServiceRoleClient();

  // Fetch order + buyer + event in one query
  const { data: order, error } = await service
    .from("event_orders")
    .select(
      `
      id, status, total_amount, payment_method,
      events:event_id (id, name, event_date, venue, image_url),
      buyers:buyer_id (email, full_name)
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return { success: false, error: "Order not found" };
  }

  const event = order.events as unknown as {
    id: string;
    name: string;
    event_date: string;
    venue: string | null;
    image_url: string | null;
  } | null;
  const buyer = order.buyers as unknown as {
    email: string;
    full_name: string | null;
  } | null;

  if (!event || !buyer) {
    return { success: false, error: "Missing event or buyer data" };
  }

  // Fetch tickets with their type info. ticket_type.bundle_items tells
  // us which rows are aggregators (the QRs we mail to the buyer) vs
  // components (omitted — they're only for headcount).
  const { data: tickets } = await service
    .from("event_tickets")
    .select(
      `
      id, qr_token, amount_paid, parent_bundle_type_id,
      ticket_type:ticket_type_id (id, name, color, bundle_items),
      parent_bundle:parent_bundle_type_id (id, name)
    `,
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (!tickets || tickets.length === 0) {
    return { success: false, error: "No tickets to send" };
  }

  // Build a name lookup for bundle-component types so we can render the
  // "2× General + 2× Menor" composition label.
  const allTypeIds = new Set<string>();
  for (const t of tickets) {
    const tt = t.ticket_type as unknown as {
      id: string;
      bundle_items: { ticket_type_id: string }[] | null;
    } | null;
    if (tt?.bundle_items) {
      for (const bi of tt.bundle_items) allTypeIds.add(bi.ticket_type_id);
    }
  }
  let typeNameById = new Map<string, string>();
  if (allTypeIds.size > 0) {
    const { data: compTypes } = await service
      .from("event_ticket_types")
      .select("id, name")
      .in("id", [...allTypeIds]);
    typeNameById = new Map(
      (compTypes ?? []).map((t) => [t.id as string, t.name as string]),
    );
  }

  const ticketRows = tickets
    // Components have no buyer-facing QR; the aggregator's QR covers
    // the whole pack. Skip them from the email.
    .filter((t) => !t.parent_bundle_type_id)
    .map((t) => {
      const tt = t.ticket_type as unknown as {
        id: string;
        name: string;
        color: string | null;
        bundle_items: { ticket_type_id: string; quantity: number }[] | null;
      } | null;
      const pb = t.parent_bundle as unknown as
        | { id: string; name: string }
        | null;
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
        id: t.id as string,
        qrToken: t.qr_token as string,
        typeName: tt?.name || "Entrada",
        typeColor: tt?.color || null,
        amountPaid: (t.amount_paid as number | null) ?? null,
        bundleParentName: pb?.name || null,
        isAggregator,
        bundleSize,
        bundleLabel,
      };
    });

  if (ticketRows.length === 0) {
    return { success: false, error: "No tickets to send" };
  }

  return await sendApprovedTicketsEmail({
    buyerName: buyer.full_name,
    buyerEmail: buyer.email,
    eventName: event.name,
    eventDate: event.event_date,
    eventVenue: event.venue,
    eventImageUrl: event.image_url,
    totalAmount: Number(order.total_amount),
    tickets: ticketRows,
    isComplimentary: order.payment_method === "cortesia",
  });
}
