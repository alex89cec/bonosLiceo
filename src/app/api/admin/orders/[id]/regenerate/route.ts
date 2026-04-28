import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  generateTicketsForOrder,
  sendOrderTicketsEmail,
} from "@/lib/event-tickets";

export const maxDuration = 30;

/**
 * POST /api/admin/orders/[id]/regenerate
 *
 * For approved/complimentary orders that don't have tickets generated
 * (e.g., due to a transient failure during approval), this re-runs the
 * ticket generation and sends the buyer email. Idempotent: if tickets
 * already exist, only the email is resent.
 *
 * Admin-only.
 */
export async function POST(
  _req: NextRequest,
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
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.is_active || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Solo admins pueden regenerar entradas" },
        { status: 403 },
      );
    }

    const { data: order, error: orderErr } = await service
      .from("event_orders")
      .select("id, status")
      .eq("id", id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    if (!["approved", "complimentary"].includes(order.status)) {
      return NextResponse.json(
        {
          error: `La orden está en estado "${order.status}". Solo se regeneran órdenes aprobadas o de cortesía.`,
        },
        { status: 400 },
      );
    }

    // Generate tickets (idempotent — if they exist, returns existing count)
    const result = await generateTicketsForOrder(id);
    if (!result.success) {
      return NextResponse.json(
        { error: `Error al generar entradas: ${result.error}` },
        { status: 500 },
      );
    }

    // Send email regardless (could be a resend if tickets already existed)
    const emailRes = await sendOrderTicketsEmail(id);
    if (!emailRes.success) {
      // Tickets exist; email failed — partial success
      return NextResponse.json(
        {
          success: false,
          tickets_count: result.count,
          error: `Tickets OK, pero falló el email: ${emailRes.error}`,
        },
        { status: 207 },
      );
    }

    return NextResponse.json({
      success: true,
      tickets_count: result.count,
    });
  } catch (err) {
    console.error("Regenerate tickets error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
