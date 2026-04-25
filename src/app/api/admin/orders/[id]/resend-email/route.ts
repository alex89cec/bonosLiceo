import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendOrderTicketsEmail } from "@/lib/event-tickets";

export const maxDuration = 30;

/** POST /api/admin/orders/[id]/resend-email — resends the approved tickets email */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

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
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Verify the order is in a state that has tickets (approved or complimentary)
    const { data: order } = await supabase
      .from("event_orders")
      .select("id, status")
      .eq("id", id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    if (!["approved", "complimentary"].includes(order.status)) {
      return NextResponse.json(
        { error: "La orden no tiene entradas emitidas todavía" },
        { status: 400 },
      );
    }

    const result = await sendOrderTicketsEmail(id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error al enviar email" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resend email error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
