import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { eventSellerAssignmentSchema } from "@/lib/validations";
import { z } from "zod";

/** POST /api/events/[id]/sellers — assign a seller to the event */
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

    // Support both single and batch assignment
    const bulkSchema = z.object({
      assignments: z.array(eventSellerAssignmentSchema).min(1),
    });
    const bulkParse = bulkSchema.safeParse(body);
    const singleParse = eventSellerAssignmentSchema.safeParse(body);

    const assignments = bulkParse.success
      ? bulkParse.data.assignments
      : singleParse.success
        ? [singleParse.data]
        : null;

    if (!assignments) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }

    const rows = assignments.map((a) => ({
      event_id: eventId,
      seller_id: a.seller_id,
      can_sell: a.can_sell,
      can_scan: a.can_scan,
    }));

    const { data, error } = await supabase
      .from("event_sellers")
      .upsert(rows, { onConflict: "event_id,seller_id" })
      .select();

    if (error) {
      console.error("Event seller assignment error:", error);
      return NextResponse.json(
        { error: "Error al asignar vendedores" },
        { status: 500 },
      );
    }

    return NextResponse.json({ assignments: data }, { status: 201 });
  } catch (err) {
    console.error("Event sellers POST error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/** DELETE /api/events/[id]/sellers?seller_id=xxx — remove a seller */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const sellerId = request.nextUrl.searchParams.get("seller_id");

    if (!sellerId) {
      return NextResponse.json(
        { error: "seller_id es requerido" },
        { status: 400 },
      );
    }

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

    // Safety: don't remove if seller already sold tickets
    const { count } = await supabase
      .from("event_tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("seller_id", sellerId);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `No se puede desasignar: el vendedor ya vendió ${count} entradas`,
        },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .from("event_sellers")
      .delete()
      .eq("event_id", eventId)
      .eq("seller_id", sellerId);

    if (error) {
      console.error("Event seller delete error:", error);
      return NextResponse.json(
        { error: "Error al desasignar vendedor" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Event sellers DELETE error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
