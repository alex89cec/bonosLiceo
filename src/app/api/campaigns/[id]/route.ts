import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { campaignSchema } from "@/lib/validations";

// Vercel serverless max duration (seconds). Free=10, Pro=60.
export const maxDuration = 10;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify admin role
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

    // Fetch campaign
    const { data: campaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaña no encontrada" },
        { status: 404 },
      );
    }

    // Count taken tickets (reserved or sold)
    const { count: takenCount } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .in("status", ["reserved", "sold"]);

    return NextResponse.json({
      campaign,
      taken_count: takenCount ?? 0,
      editable: (takenCount ?? 0) === 0,
    });
  } catch (err) {
    console.error("Campaign fetch error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    // 3. Fetch current campaign
    const { data: existingCampaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingCampaign) {
      return NextResponse.json(
        { error: "Campaña no encontrada" },
        { status: 404 },
      );
    }

    // 4. Check if any tickets are taken (reserved or sold)
    const { count: takenCount } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .in("status", ["reserved", "sold"]);

    if ((takenCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede editar esta campaña porque tiene números reservados o vendidos",
        },
        { status: 409 },
      );
    }

    // 5. Parse and validate body
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

    // 6. Validate date ordering
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      return NextResponse.json(
        { error: "La fecha de fin debe ser posterior a la fecha de inicio" },
        { status: 400 },
      );
    }

    // 7. Validate number range size
    const rangeSize = data.number_to - data.number_from + 1;
    if (rangeSize > 100000) {
      return NextResponse.json(
        { error: "El rango máximo es de 100,000 números por campaña" },
        { status: 400 },
      );
    }

    // 8. Check if number range changed
    const rangeChanged =
      data.number_from !== existingCampaign.number_from ||
      data.number_to !== existingCampaign.number_to;

    // 9. Update campaign
    const { data: campaign, error: updateError } = await supabase
      .from("campaigns")
      .update({
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
        status: body.status || existingCampaign.status,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "23505" && updateError.message.includes("slug")) {
        return NextResponse.json(
          { error: "Ya existe una campaña con ese slug" },
          { status: 409 },
        );
      }

      console.error("Campaign update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar la campaña" },
        { status: 500 },
      );
    }

    // 10. If range changed, regenerate tickets via single DB function call
    if (rangeChanged && campaign) {
      const { error: regenError } = await supabase.rpc(
        "regenerate_campaign_tickets",
        {
          p_campaign_id: id,
          p_number_from: data.number_from,
          p_number_to: data.number_to,
        },
      );

      if (regenError) {
        console.error("Error regenerating tickets:", regenError);
        return NextResponse.json(
          { error: "Error al regenerar los números de la campaña" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error("Campaign update error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
