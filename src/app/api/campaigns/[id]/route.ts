import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { campaignSchema } from "@/lib/validations";

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

    // 8. Check if number range changed — if so, delete old tickets and let trigger regenerate
    const rangeChanged =
      data.number_from !== existingCampaign.number_from ||
      data.number_to !== existingCampaign.number_to;

    if (rangeChanged) {
      // Delete all existing tickets (all are available since we checked above)
      const { error: deleteError } = await supabase
        .from("tickets")
        .delete()
        .eq("campaign_id", id);

      if (deleteError) {
        console.error("Error deleting tickets:", deleteError);
        return NextResponse.json(
          { error: "Error al actualizar los números de la campaña" },
          { status: 500 },
        );
      }
    }

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

    // 10. If range changed, regenerate tickets
    if (rangeChanged && campaign) {
      const tickets = [];
      for (let i = data.number_from; i <= data.number_to; i++) {
        tickets.push({
          campaign_id: id,
          number: String(i).padStart(5, "0"),
          status: "available" as const,
          seller_id: null,
        });
      }

      // Insert in batches of 1000
      for (let i = 0; i < tickets.length; i += 1000) {
        const batch = tickets.slice(i, i + 1000);
        const { error: insertError } = await supabase
          .from("tickets")
          .insert(batch);

        if (insertError) {
          console.error("Error inserting tickets batch:", insertError);
          return NextResponse.json(
            { error: "Error al regenerar los números de la campaña" },
            { status: 500 },
          );
        }
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
