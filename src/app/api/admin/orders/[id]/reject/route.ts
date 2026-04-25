import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().min(1).max(500),
});

/** POST /api/admin/orders/[id]/reject */
export async function POST(
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
      .select("role, is_approver")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin" || !profile.is_approver) {
      return NextResponse.json(
        { error: "Solo aprobadores pueden rechazar órdenes" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = rejectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Debe incluir un motivo de rechazo" },
        { status: 400 },
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

    if (order.status !== "pending_review") {
      return NextResponse.json(
        { error: `La orden no se puede rechazar (estado actual: ${order.status})` },
        { status: 400 },
      );
    }

    const { error: updateErr } = await service
      .from("event_orders")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: parsed.data.reason,
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Reject error:", updateErr);
      return NextResponse.json(
        { error: "Error al rechazar la orden" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reject order error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
