import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";
import { emailSchema } from "@/lib/validations";
import { generateTicketsForOrder } from "@/lib/event-tickets";
import { sendTransferInstructionsEmail } from "@/lib/email";

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
  /** If true, the order is created without a receipt; status=awaiting_receipt */
  is_preventa: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
  /** Seller code for public orders (attribution). Ignored for authenticated sellers. */
  seller_code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
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
      .select(
        "id, status, name, event_date, venue, transfer_holder_name, transfer_cbu, transfer_alias, transfer_bank, transfer_id_number, transfer_instructions",
      )
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

    // Fetch ticket types referenced in items (+ bundle metadata)
    const typeIds = input.items.map((i) => i.ticket_type_id);
    const { data: ticketTypes, error: typesErr } = await service
      .from("event_ticket_types")
      .select("id, name, price, quantity, is_complimentary, is_bundle_only, bundle_items")
      .eq("event_id", eventId)
      .in("id", typeIds);

    if (typesErr || !ticketTypes || ticketTypes.length !== typeIds.length) {
      return NextResponse.json(
        { error: "Algún tipo de entrada no existe" },
        { status: 400 },
      );
    }

    // Reject is_bundle_only types from being ordered directly
    for (const t of ticketTypes) {
      if (t.is_bundle_only) {
        return NextResponse.json(
          { error: `"${t.name}" solo se vende dentro de un pack` },
          { status: 400 },
        );
      }
    }

    // Compute total + build snapshot
    // For bundles, the snapshot also stores composition for the email/admin UI
    let totalAmount = 0;
    const itemsSnapshot = input.items.map((item) => {
      const t = ticketTypes.find((tt) => tt.id === item.ticket_type_id)!;
      const unitPrice = input.payment_method === "cortesia" ? 0 : Number(t.price);
      totalAmount += unitPrice * item.quantity;
      const components = t.bundle_items as
        | { ticket_type_id: string; quantity: number }[]
        | null;
      return {
        ticket_type_id: t.id,
        name: t.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        is_bundle: Boolean(components && components.length > 0),
        bundle_items: components || null,
      };
    });

    // Stock check — for both regular types and bundles, just check
    // the type's own quantity. Bundles have independent stock from their
    // component types (an admin allocating "50 packs" means 50 packs total,
    // separate from the 200 individual adults).
    for (const item of input.items) {
      const t = ticketTypes.find((tt) => tt.id === item.ticket_type_id)!;

      // Unlimited: no stock check
      if (t.quantity === null) continue;

      // Count tickets already valid/used for this type
      // (For bundles, count tickets where parent_bundle_type_id = bundle.id)
      const isBundle = t.bundle_items && (t.bundle_items as unknown[]).length > 0;
      const ticketsCountQuery = isBundle
        ? service
            .from("event_tickets")
            .select("id", { count: "exact", head: true })
            .eq("parent_bundle_type_id", t.id)
            .in("status", ["valid", "used"])
        : service
            .from("event_tickets")
            .select("id", { count: "exact", head: true })
            .eq("ticket_type_id", t.id)
            .is("parent_bundle_type_id", null) // exclude bundle-children
            .in("status", ["valid", "used"]);

      const { count: currentlyTaken } = await ticketsCountQuery;

      // Pending orders (not yet approved) — count by item.ticket_type_id
      const { data: pendingOrders } = await service
        .from("event_orders")
        .select("items")
        .eq("event_id", eventId)
        .in("status", ["pending_review", "awaiting_receipt"]);

      let pendingCount = 0;
      for (const o of pendingOrders || []) {
        const items = o.items as { ticket_type_id: string; quantity: number }[];
        for (const it of items) {
          if (it.ticket_type_id === t.id) pendingCount += it.quantity;
        }
      }

      // For bundles, "currentlyTaken" is # of bundle-instance tickets generated;
      // we need to translate to # of bundles by dividing by tickets-per-bundle.
      let occupied = pendingCount;
      if (isBundle) {
        const components = t.bundle_items as { ticket_type_id: string; quantity: number }[];
        const ticketsPerBundle = components.reduce((s, c) => s + c.quantity, 0);
        occupied += Math.ceil((currentlyTaken || 0) / Math.max(ticketsPerBundle, 1));
      } else {
        occupied += currentlyTaken || 0;
      }

      if (occupied + item.quantity > t.quantity) {
        return NextResponse.json(
          {
            error: `No hay suficientes ${t.name}. Disponibles: ${Math.max(0, t.quantity - occupied)}`,
          },
          { status: 409 },
        );
      }
    }

    // Preventa is only allowed for sellers/admins (not for public)
    if (input.is_preventa && role === "public") {
      return NextResponse.json(
        { error: "El comprobante es obligatorio en compras desde la web" },
        { status: 400 },
      );
    }

    // Cortesia + preventa is meaningless
    if (input.is_preventa && input.payment_method === "cortesia") {
      return NextResponse.json(
        { error: "Las cortesías no pueden ser preventa" },
        { status: 400 },
      );
    }

    // Validate receipt (skip if preventa or cortesia)
    if (input.payment_method === "transferencia" && !input.is_preventa) {
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
    let initialStatus: "complimentary" | "pending_review" | "awaiting_receipt";
    if (input.payment_method === "cortesia") {
      initialStatus = "complimentary";
    } else if (input.is_preventa) {
      initialStatus = "awaiting_receipt";
    } else {
      initialStatus = "pending_review";
    }

    // Resolve seller_id:
    // - If user is a seller, attribute to themselves (ignore seller_code in body)
    // - If public order with seller_code, look up and validate
    let resolvedSellerId: string | null = null;
    if (role === "seller") {
      resolvedSellerId = user!.id;
    } else if (role === "public" && input.seller_code) {
      const { data: sellerProfile } = await service
        .from("profiles")
        .select("id, is_active")
        .eq("seller_code", input.seller_code)
        .single();

      if (sellerProfile && sellerProfile.is_active) {
        const { data: assignment } = await service
          .from("event_sellers")
          .select("can_sell")
          .eq("event_id", eventId)
          .eq("seller_id", sellerProfile.id)
          .single();

        if (assignment?.can_sell) {
          resolvedSellerId = sellerProfile.id;
        }
        // If invalid (not assigned or can't sell), silently drop the attribution
        // — order still goes through, just without seller credit
      }
    }

    // Insert order
    const { data: order, error: orderErr } = await service
      .from("event_orders")
      .insert({
        event_id: eventId,
        buyer_id: buyer.id,
        seller_id: resolvedSellerId,
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

    // If preventa (awaiting_receipt), send transfer instructions email to buyer
    if (input.is_preventa && initialStatus === "awaiting_receipt") {
      // Fetch seller info if applicable
      let sellerName: string | null = null;
      let sellerEmail: string | null = null;
      if (role === "seller" && user) {
        const { data: sellerProfile } = await service
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();
        if (sellerProfile) {
          sellerName = sellerProfile.full_name;
          sellerEmail = sellerProfile.email;
        }
      }

      // Fire-and-forget — don't block the response
      sendTransferInstructionsEmail({
        buyerName: input.buyer_name,
        buyerEmail: input.buyer_email,
        eventName: event.name,
        eventDate: event.event_date,
        eventVenue: event.venue,
        items: itemsSnapshot,
        totalAmount,
        holderName: event.transfer_holder_name,
        cbu: event.transfer_cbu,
        alias: event.transfer_alias,
        bank: event.transfer_bank,
        idNumber: event.transfer_id_number,
        instructions: event.transfer_instructions,
        sellerName,
        sellerEmail,
      }).catch((err) => {
        console.error("Transfer email send failed:", err);
      });
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
