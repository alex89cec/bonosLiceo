import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/validations";

/** GET /api/events — list all events (admin only) */
export async function GET() {
  try {
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

    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false });

    if (error) {
      console.error("Events list error:", error);
      return NextResponse.json(
        { error: "Error al cargar eventos" },
        { status: 500 },
      );
    }

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Events GET error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/** POST /api/events — create new event (admin only) */
export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        { error: "Acceso denegado. Solo administradores." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = eventSchema.safeParse(body);

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

    const { data: event, error: insertError } = await supabase
      .from("events")
      .insert({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        event_date: data.event_date,
        venue: data.venue || null,
        image_url: data.image_url || null,
        status: data.status,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (
        insertError.code === "23505" &&
        insertError.message.includes("slug")
      ) {
        return NextResponse.json(
          { error: "Ya existe un evento con ese slug" },
          { status: 409 },
        );
      }

      console.error("Event insert error:", insertError);
      return NextResponse.json(
        { error: "Error al crear el evento" },
        { status: 500 },
      );
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error("Event creation error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
