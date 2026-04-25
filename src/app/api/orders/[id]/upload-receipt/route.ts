import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/orders/[id]/upload-receipt
 *
 * Multipart form-data with:
 * - receipt: File (PDF or image)
 *
 * Auth:
 * - The seller who created the order
 * - Any admin
 *
 * Transitions order from 'awaiting_receipt' → 'pending_review'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params;
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

    // Get the order
    const { data: order, error: orderErr } = await service
      .from("event_orders")
      .select("id, event_id, seller_id, status, payment_method")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    // Authorization: only the seller who created or admins
    const isAdmin = profile.role === "admin";
    const isOwnSeller = profile.role === "seller" && order.seller_id === user.id;
    if (!isAdmin && !isOwnSeller) {
      return NextResponse.json(
        { error: "Solo el vendedor que creó la orden o un admin puede subir el comprobante" },
        { status: 403 },
      );
    }

    // Order must be in awaiting_receipt
    if (order.status !== "awaiting_receipt") {
      return NextResponse.json(
        {
          error: `La orden no está esperando comprobante (estado actual: ${order.status})`,
        },
        { status: 400 },
      );
    }

    // Parse file
    const formData = await request.formData();
    const file = formData.get("receipt");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "El comprobante es obligatorio" },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo de 5MB" },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se aceptan PDF, JPG, PNG o WEBP" },
        { status: 400 },
      );
    }

    // Upload
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safePath = `${order.event_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadErr } = await service.storage
      .from("event-receipts")
      .upload(safePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Receipt upload error:", uploadErr);
      return NextResponse.json(
        { error: "Error al subir el comprobante" },
        { status: 500 },
      );
    }

    // Update order: set receipt + transition to pending_review
    const { error: updateErr } = await service
      .from("event_orders")
      .update({
        receipt_url: safePath,
        receipt_filename: file.name,
        receipt_mime_type: file.type,
        receipt_uploaded_at: new Date().toISOString(),
        status: "pending_review",
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("Order update error:", updateErr);
      // Cleanup
      await service.storage.from("event-receipts").remove([safePath]);
      return NextResponse.json(
        { error: "Error al actualizar la orden" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Upload receipt error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
