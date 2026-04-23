import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { eventTicketTypeSchema } from "@/lib/validations";

/** PUT /api/events/[id]/ticket-types/[typeId] — update ticket type */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; typeId: string }> },
) {
  try {
    const { id: eventId, typeId } = await params;
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

    const body = await request.json();
    const parsed = eventTicketTypeSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { data: ticketType, error } = await supabase
      .from("event_ticket_types")
      .update(parsed.data)
      .eq("id", typeId)
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) {
      console.error("Ticket type update error:", error);
      return NextResponse.json(
        { error: "Error al actualizar el tipo de entrada" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ticket_type: ticketType });
  } catch (err) {
    console.error("Ticket type PUT error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/** DELETE /api/events/[id]/ticket-types/[typeId] — delete ticket type */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; typeId: string }> },
) {
  try {
    const { id: eventId, typeId } = await params;
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

    // Check if any tickets have been sold for this type
    const { count } = await supabase
      .from("event_tickets")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type_id", typeId);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: el tipo ya tiene ${count} entradas vendidas`,
        },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .from("event_ticket_types")
      .delete()
      .eq("id", typeId)
      .eq("event_id", eventId);

    if (error) {
      console.error("Ticket type delete error:", error);
      return NextResponse.json(
        { error: "Error al eliminar el tipo de entrada" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Ticket type DELETE error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
