import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/validations";

async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { supabase, user, isAdmin: profile?.role === "admin" };
}

/** GET /api/events/[id] — get event + ticket types + sellers */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, isAdmin } = await assertAdmin();

    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const [eventRes, typesRes, sellersRes] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).single(),
      supabase
        .from("event_ticket_types")
        .select("*")
        .eq("event_id", id)
        .order("display_order", { ascending: true }),
      supabase
        .from("event_sellers")
        .select("*, profiles:seller_id(id, full_name, email, seller_code)")
        .eq("event_id", id),
    ]);

    if (eventRes.error || !eventRes.data) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      event: eventRes.data,
      ticket_types: typesRes.data || [],
      sellers: sellersRes.data || [],
    });
  } catch (err) {
    console.error("Event GET error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/** PUT /api/events/[id] — update event */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, isAdmin } = await assertAdmin();

    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const body = await request.json();
    const parsed = eventSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { data: event, error } = await supabase
      .from("events")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && error.message.includes("slug")) {
        return NextResponse.json(
          { error: "Ya existe un evento con ese slug" },
          { status: 409 },
        );
      }
      console.error("Event update error:", error);
      return NextResponse.json(
        { error: "Error al actualizar el evento" },
        { status: 500 },
      );
    }

    return NextResponse.json({ event });
  } catch (err) {
    console.error("Event PUT error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/events/[id] — delete event.
 *
 * Default: blocks if any tickets/orders exist (returns 409 with counts).
 * With `?force=true`: cascades — removes receipt files from storage,
 * deletes tickets, orders, types, sellers, scan_logs, and finally the
 * event itself.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, isAdmin } = await assertAdmin();

    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const force = request.nextUrl.searchParams.get("force") === "true";

    // Service role for the cascade (bypasses RLS, allows storage cleanup)
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const service = createServiceRoleClient();

    const [{ count: ticketCount }, { count: orderCount }] = await Promise.all([
      service
        .from("event_tickets")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id),
      service
        .from("event_orders")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id),
    ]);

    const hasData = (ticketCount || 0) > 0 || (orderCount || 0) > 0;

    if (hasData && !force) {
      return NextResponse.json(
        {
          error: "El evento tiene datos asociados",
          ticket_count: ticketCount || 0,
          order_count: orderCount || 0,
          message:
            "Confirmá con ?force=true para borrar también las entradas y órdenes, o cambia el estado a 'past' para preservar el histórico.",
        },
        { status: 409 },
      );
    }

    if (force && hasData) {
      // 1. Collect receipt storage paths
      const { data: orders } = await service
        .from("event_orders")
        .select("receipt_url")
        .eq("event_id", id);

      const receiptPaths = (orders || [])
        .map((o) => o.receipt_url as string | null)
        .filter((p): p is string => Boolean(p));

      if (receiptPaths.length > 0) {
        const { error: storageErr } = await service.storage
          .from("event-receipts")
          .remove(receiptPaths);
        if (storageErr) {
          console.warn(
            "Storage cleanup partial failure (continuing):",
            storageErr,
          );
        }
      }

      // 2. Manual cascade — explicit ordering avoids FK violations
      // event_scan_logs has ON DELETE SET NULL, but clear it for cleanliness
      await service.from("event_scan_logs").delete().eq("event_id", id);
      // event_tickets has ON DELETE RESTRICT — must clear before event
      await service.from("event_tickets").delete().eq("event_id", id);
      // event_orders has ON DELETE RESTRICT — must clear before event
      await service.from("event_orders").delete().eq("event_id", id);
      // event_ticket_types and event_sellers have ON DELETE CASCADE,
      // they go automatically when the event is deleted next
    }

    const { error } = await service.from("events").delete().eq("id", id);

    if (error) {
      console.error("Event delete error:", error);
      return NextResponse.json(
        { error: "Error al eliminar el evento" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      cascaded: force && hasData,
      ticket_count: ticketCount || 0,
      order_count: orderCount || 0,
    });
  } catch (err) {
    console.error("Event DELETE error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
