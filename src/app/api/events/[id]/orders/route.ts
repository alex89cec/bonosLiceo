import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";
import { emailSchema } from "@/lib/validations";
import { generateTicketsForOrder } from "@/lib/event-tickets";

export const maxDuration = 60;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const orderItemSchema = z.object({
  ticket_type_id: z.string().uuid(),
  quantity: z.number().int().positive().max(50),
});

const orderInputSchema = z.object({
  buyer_email: emailSchema,
  buyer_name: z.string().min(1).max(200),
  buyer_phone: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1),
  payment_method: z.enum(["transferencia", "cortesia"]),
  notes: z.string().optional().nullable(),
});

/**
 * POST /api/events/[id]/orders
 *
 * Body must be multipart/form-data with:
 * - data: JSON string of orderInputSchema
 * - receipt: file (PDF or image), required unless cortesia
 *
 * Auth:
 * - Sellers (with can_sell on the event) — creates order with seller_id = self
 * - Admins — can create orders for any event; cortesia is admin-only
 * - Public/anon — allowed only if event is active and not cortesia (portal)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createServerSupabaseClient();
    const service = createServiceRoleClient();

    // Auth (optional — public can also order)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let role: "admin" | "seller" | "public" = "public";
    let canSellEvent = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") role = "admin";
      else if (profile?.role === "seller" && profile.is_active) {
        role = "seller";
        const { data: assignment } = await supabase
          .from("event_sellers")
          .select("can_sell")
          .eq("event_id", eventId)
          .eq("seller_id", user.id)
          .single();
        canSellEvent = assignment?.can_sell === true;
      }
    }

    // Parse multipart
    const formData = await request.formData();
    const dataRaw = formData.get("data");
    const file = formData.get("receipt");

    if (typeof dataRaw !== "string") {
      return NextResponse.json(
        { error: "Falta el campo 'data' con el detalle de la orden" },
        { status: 400 },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(dataRaw);
    } catch {
      return NextResponse.json({ error: "data no es JSON válido" }, { status: 400 });
    }

    const parsed = orderInputSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // Authorization
    if (input.payment_method === "cortesia" && role !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden emitir cortesías" },
        { status: 403 },
      );
    }

    if (role === "seller" && !canSellEvent) {
      return NextResponse.json(
        { error: "No tenés permiso para vender en este evento" },
        { status: 403 },
      );
    }

    // Fetch event + verify it's bookable
    const { data: event, error: eventErr } = await service
      .from("events")
      .select("id, status, name")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    if (role === "public" && event.status !== "active") {
      return NextResponse.json(
        { error: "Este evento no está disponible para compra" },
        { status: 400 },
      );
    }

    // Fetch ticket types referenced in items
    const typeIds = input.items.map((i) => i.ticket_type_id);
    const { data: ticketTypes, error: typesErr } = await service
      .from("event_ticket_types")
      .select("id, name, price, quantity, is_complimentary")
      .eq("event_id", eventId)
      .in("id", typeIds);

    if (typesErr || !ticketTypes || ticketTypes.length !== typeIds.length) {
      return NextResponse.json(
        { error: "Algún tipo de entrada no existe" },
        { status: 400 },
      );
    }

    // Compute total + verify cortesia constraint
    let totalAmount = 0;
    const itemsSnapshot = input.items.map((item) => {
      const t = ticketTypes.find((tt) => tt.id === item.ticket_type_id)!;
      const unitPrice = input.payment_method === "cortesia" ? 0 : Number(t.price);
      totalAmount += unitPrice * item.quantity;
      return {
        ticket_type_id: t.id,
        name: t.name,
        quantity: item.quantity,
        unit_price: unitPrice,
      };
    });

    // Check stock per type
    for (const item of input.items) {
      const t = ticketTypes.find((tt) => tt.id === item.ticket_type_id)!;
      // Count tickets already valid/used/pending for this type
      const { count: currentlyTaken } = await service
        .from("event_tickets")
        .select("id", { count: "exact", head: true })
        .eq("ticket_type_id", t.id)
        .in("status", ["valid", "used"]);

      // Plus pending (orders not yet approved)
      const { data: pendingOrders } = await service
        .from("event_orders")
        .select("items")
        .eq("event_id", eventId)
        .eq("status", "pending_review");

      let pendingCount = 0;
      for (const o of pendingOrders || []) {
        const items = o.items as { ticket_type_id: string; quantity: number }[];
        for (const it of items) {
          if (it.ticket_type_id === t.id) pendingCount += it.quantity;
        }
      }

      const taken = (currentlyTaken || 0) + pendingCount;
      if (taken + item.quantity > t.quantity) {
        return NextResponse.json(
          {
            error: `No hay suficientes ${t.name}. Disponibles: ${Math.max(0, t.quantity - taken)}`,
          },
          { status: 409 },
        );
      }
    }

    // Validate receipt
    if (input.payment_method === "transferencia") {
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "El comprobante de transferencia es obligatorio" },
          { status: 400 },
        );
      }
      if (file.size === 0) {
        return NextResponse.json(
          { error: "El archivo está vacío" },
          { status: 400 },
        );
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
    }

    // Upsert buyer
    const { data: buyer, error: buyerErr } = await service
      .from("buyers")
      .upsert(
        {
          email: input.buyer_email,
          full_name: input.buyer_name,
          phone: input.buyer_phone || null,
        },
        { onConflict: "email" },
      )
      .select()
      .single();

    if (buyerErr || !buyer) {
      console.error("Buyer upsert error:", buyerErr);
      return NextResponse.json(
        { error: "Error al guardar comprador" },
        { status: 500 },
      );
    }

    // Upload receipt (if present)
    let receiptUrl: string | null = null;
    let receiptFilename: string | null = null;
    let receiptMime: string | null = null;
    let receiptUploadedAt: string | null = null;

    if (file instanceof File && file.size > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safePath = `${eventId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
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
      receiptUrl = safePath;
      receiptFilename = file.name;
      receiptMime = file.type;
      receiptUploadedAt = new Date().toISOString();
    }

    // Determine initial status
    const initialStatus =
      input.payment_method === "cortesia" ? "complimentary" : "pending_review";

    // Insert order
    const { data: order, error: orderErr } = await service
      .from("event_orders")
      .insert({
        event_id: eventId,
        buyer_id: buyer.id,
        seller_id: role === "seller" ? user!.id : null,
        items: itemsSnapshot,
        total_amount: totalAmount,
        payment_method: input.payment_method,
        receipt_url: receiptUrl,
        receipt_filename: receiptFilename,
        receipt_mime_type: receiptMime,
        receipt_uploaded_at: receiptUploadedAt,
        status: initialStatus,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error("Order insert error:", orderErr);
      // Cleanup uploaded file
      if (receiptUrl) {
        await service.storage.from("event-receipts").remove([receiptUrl]);
      }
      return NextResponse.json(
        { error: "Error al crear la orden" },
        { status: 500 },
      );
    }

    // If cortesía, generate tickets immediately (auto-approved)
    if (input.payment_method === "cortesia") {
      const result = await generateTicketsForOrder(order.id);
      if (!result.success) {
        console.error("Ticket generation error:", result.error);
        // Don't fail the request — the order is in DB; admin can retry
      }
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error("Order POST error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
