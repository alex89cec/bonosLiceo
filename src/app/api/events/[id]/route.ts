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

/** DELETE /api/events/[id] — delete event (only if no tickets sold) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, isAdmin } = await assertAdmin();

    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    // Check if any tickets have been sold
    const { count: ticketCount } = await supabase
      .from("event_tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id);

    if (ticketCount && ticketCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: el evento ya tiene ${ticketCount} entradas vendidas` },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      console.error("Event delete error:", error);
      return NextResponse.json(
        { error: "Error al eliminar el evento" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Event DELETE error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
