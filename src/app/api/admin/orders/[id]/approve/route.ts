import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generateTicketsForOrder } from "@/lib/event-tickets";

export const maxDuration = 30;

/** POST /api/admin/orders/[id]/approve */
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
      .select("role, is_approver")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin" || !profile.is_approver) {
      return NextResponse.json(
        { error: "Solo aprobadores pueden aprobar órdenes" },
        { status: 403 },
      );
    }

    // Verify order is in pending_review state
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

    if (order.status !== "pending_review") {
      return NextResponse.json(
        { error: `La orden no se puede aprobar (estado actual: ${order.status})` },
        { status: 400 },
      );
    }

    // Update order to approved
    const { error: updateErr } = await service
      .from("event_orders")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Order approval update error:", updateErr);
      return NextResponse.json(
        { error: "Error al aprobar la orden" },
        { status: 500 },
      );
    }

    // Generate tickets
    const result = await generateTicketsForOrder(id);
    if (!result.success) {
      console.error("Ticket generation failed:", result.error);
      return NextResponse.json(
        {
          error: "Orden aprobada pero falló la generación de entradas. Reintentar manualmente.",
          details: result.error,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      tickets_generated: result.count,
    });
  } catch (err) {
    console.error("Approve order error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
