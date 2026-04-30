import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";
import { emailSchema } from "@/lib/validations";

const inputSchema = z.object({
  email: emailSchema,
});

/**
 * PATCH /api/admin/orders/[id]/buyer-email
 *
 * Admin-only. Re-links one event order (and any tickets it generated)
 * to a buyer with the new email. If a buyer with that email already
 * exists, re-uses it; otherwise creates a new buyer copying name/phone
 * from the previous buyer.
 *
 * Other orders of the original buyer are NOT touched. The tickets that
 * belong to this order get re-linked too so /mis-entradas keeps working.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const service = createServiceRoleClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Solo admins pueden modificar el email" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    const newEmail = parsed.data.email;

    // Get current order + previous buyer
    const { data: order } = await service
      .from("event_orders")
      .select("id, buyer_id")
      .eq("id", id)
      .single();
    if (!order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    const { data: oldBuyer } = await service
      .from("buyers")
      .select("id, full_name, phone")
      .eq("id", order.buyer_id)
      .single();

    // Find or create buyer
    let { data: buyer } = await service
      .from("buyers")
      .select("id, email")
      .eq("email", newEmail)
      .maybeSingle();

    if (!buyer) {
      const { data: newBuyer, error: createErr } = await service
        .from("buyers")
        .insert({
          email: newEmail,
          full_name: oldBuyer?.full_name || null,
          phone: oldBuyer?.phone || null,
        })
        .select("id, email")
        .single();
      if (createErr || !newBuyer) {
        console.error("Buyer create error:", createErr);
        return NextResponse.json(
          { error: "Error al crear comprador" },
          { status: 500 },
        );
      }
      buyer = newBuyer;
    }

    // Update order + any tickets that belong to it
    const { error: orderErr } = await service
      .from("event_orders")
      .update({ buyer_id: buyer.id })
      .eq("id", id);
    if (orderErr) {
      console.error("Order update error:", orderErr);
      return NextResponse.json(
        { error: "Error al actualizar la orden" },
        { status: 500 },
      );
    }

    await service
      .from("event_tickets")
      .update({ buyer_id: buyer.id })
      .eq("order_id", id);

    return NextResponse.json({
      success: true,
      buyer: { id: buyer.id, email: buyer.email },
    });
  } catch (err) {
    console.error("Order buyer-email PATCH error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
