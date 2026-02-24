import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { campaignSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Verify admin role
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

    // 3. Parse and validate body
    const body = await request.json();
    const parsed = campaignSchema.safeParse(body);

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

    // 4. Validate date ordering
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      return NextResponse.json(
        { error: "La fecha de fin debe ser posterior a la fecha de inicio" },
        { status: 400 },
      );
    }

    // 5. Validate number range size (max 10000 tickets per campaign)
    const rangeSize = data.number_to - data.number_from + 1;
    if (rangeSize > 100000) {
      return NextResponse.json(
        { error: "El rango máximo es de 100,000 números por campaña" },
        { status: 400 },
      );
    }

    // 6. Insert campaign (trigger auto-generates tickets)
    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        start_date: data.start_date,
        end_date: data.end_date,
        ticket_price: data.ticket_price,
        number_from: data.number_from,
        number_to: data.number_to,
        installments_enabled: data.installments_enabled,
        installments_count: data.installments_enabled
          ? data.installments_count
          : 1,
        max_tickets_per_buyer: data.max_tickets_per_buyer,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique slug constraint violation
      if (
        insertError.code === "23505" &&
        insertError.message.includes("slug")
      ) {
        return NextResponse.json(
          { error: "Ya existe una campaña con ese slug" },
          { status: 409 },
        );
      }

      // Handle date check constraint
      if (
        insertError.code === "23514" &&
        insertError.message.includes("end_date")
      ) {
        return NextResponse.json(
          {
            error: "La fecha de fin debe ser posterior a la fecha de inicio",
          },
          { status: 400 },
        );
      }

      console.error("Campaign insert error:", insertError);
      return NextResponse.json(
        { error: "Error al crear la campaña" },
        { status: 500 },
      );
    }

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    console.error("Campaign creation error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
