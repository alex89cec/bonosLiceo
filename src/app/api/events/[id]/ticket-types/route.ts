import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { eventTicketTypeSchema } from "@/lib/validations";

/** POST /api/events/[id]/ticket-types — create ticket type for an event */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
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
    const parsed = eventTicketTypeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const { data: ticketType, error } = await supabase
      .from("event_ticket_types")
      .insert({
        event_id: eventId,
        name: data.name,
        description: data.description || null,
        price: data.price,
        quantity: data.quantity,
        color: data.color,
        sales_start_at: data.sales_start_at || null,
        sales_end_at: data.sales_end_at || null,
        is_complimentary: data.is_complimentary,
        display_order: data.display_order,
      })
      .select()
      .single();

    if (error) {
      console.error("Ticket type insert error:", error);
      return NextResponse.json(
        { error: "Error al crear el tipo de entrada" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ticket_type: ticketType }, { status: 201 });
  } catch (err) {
    console.error("Ticket type POST error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
