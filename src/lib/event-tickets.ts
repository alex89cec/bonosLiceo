import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateQrToken } from "@/lib/qr-token";

interface OrderItemSnapshot {
  ticket_type_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Generate event_tickets rows for an approved/complimentary order.
 * Idempotent: if tickets already exist for the order, returns existing count.
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

  const rows: {
    id: string;
    event_id: string;
    ticket_type_id: string;
    buyer_id: string;
    seller_id: string | null;
    order_id: string;
    qr_token: string;
    amount_paid: number;
    is_complimentary: boolean;
    status: "valid";
  }[] = [];

  for (const item of items) {
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
        is_complimentary: order.payment_method === "cortesia",
        status: "valid",
      });
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
