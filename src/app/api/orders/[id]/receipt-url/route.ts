import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * GET /api/orders/[id]/receipt-url
 *
 * Returns a short-lived signed URL for the receipt file of the order.
 *
 * Authorization:
 * - Admins for any order
 * - The order's own seller (for sellers viewing their own dashboard)
 */
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
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.is_active) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { data: order, error: orderErr } = await service
      .from("event_orders")
      .select("id, seller_id, receipt_url")
      .eq("id", id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    const isAdmin = profile.role === "admin";
    const isOwnSeller =
      profile.role === "seller" && order.seller_id === user.id;
    if (!isAdmin && !isOwnSeller) {
      return NextResponse.json(
        { error: "Solo el vendedor o un admin pueden ver el comprobante" },
        { status: 403 },
      );
    }

    if (!order.receipt_url) {
      return NextResponse.json(
        { error: "Esta orden no tiene comprobante" },
        { status: 404 },
      );
    }

    const { data: signed } = await service.storage
      .from("event-receipts")
      .createSignedUrl(order.receipt_url, 3600);

    if (!signed?.signedUrl) {
      return NextResponse.json(
        { error: "Error al generar URL del comprobante" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    console.error("Receipt URL error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
