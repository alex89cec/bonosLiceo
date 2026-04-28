import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

/** GET /api/admin/orders/[id] — order detail with signed receipt URL */
export async function GET(
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
      .select("role, is_active, is_approver")
      .eq("id", user.id)
      .single();

    const allowed =
      profile?.is_active &&
      (profile.role === "admin" || profile.is_approver === true);
    if (!profile || !allowed) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { data: order, error } = await supabase
      .from("event_orders")
      .select(
        "*, events:event_id(id, name, slug, event_date, venue), buyers:buyer_id(email, full_name, phone), profiles:seller_id(full_name, seller_code, email)",
      )
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    // Generate signed URL for receipt (1h expiry)
    let receiptSignedUrl: string | null = null;
    if (order.receipt_url) {
      const { data: signed } = await service.storage
        .from("event-receipts")
        .createSignedUrl(order.receipt_url, 3600);
      receiptSignedUrl = signed?.signedUrl || null;
    }

    return NextResponse.json({
      order,
      can_approve: profile.is_approver === true,
      receipt_signed_url: receiptSignedUrl,
    });
  } catch (err) {
    console.error("Order GET error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
