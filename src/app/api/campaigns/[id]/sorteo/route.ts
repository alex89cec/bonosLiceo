import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sorteoSchema } from "@/lib/validations";

export const maxDuration = 10;

/**
 * GET /api/campaigns/[id]/sorteo
 * Fetch winners + eligible ticket count for a campaign.
 */
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

    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient();

    // Fetch winners ordered by position
    const { data: winners, error: winnersError } = await serviceClient
      .from("winners")
      .select("*")
      .eq("campaign_id", id)
      .order("position", { ascending: true });

    if (winnersError) {
      return NextResponse.json({ error: winnersError.message }, { status: 500 });
    }

    // Count eligible tickets: sold tickets minus already-won tickets
    const { count: soldCount } = await serviceClient
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "sold");

    const winnerCount = (winners || []).length;
    const eligibleCount = Math.max(0, (soldCount ?? 0) - winnerCount);

    // Get campaign status
    const { data: campaign } = await serviceClient
      .from("campaigns")
      .select("status")
      .eq("id", id)
      .single();

    return NextResponse.json({
      winners: winners || [],
      eligible_count: eligibleCount,
      campaign_status: campaign?.status || "active",
    });
  } catch (err) {
    console.error("GET sorteo error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/campaigns/[id]/sorteo
 * Draw winners: random or manual mode.
 */
export async function POST(
  request: Request,
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

    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = sorteoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    // Use the authenticated client to call RPCs (they check auth.uid())
    if (parsed.data.mode === "random") {
      const { data, error } = await supabase.rpc("draw_random_winners", {
        p_campaign_id: id,
        p_count: parsed.data.count,
      });

      if (error) {
        // Extract PostgreSQL error message
        const msg = error.message || "Error al realizar el sorteo";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      return NextResponse.json(data);
    } else {
      // Manual mode
      const { data, error } = await supabase.rpc("add_manual_winner", {
        p_campaign_id: id,
        p_ticket_number: parsed.data.ticket_number,
      });

      if (error) {
        const msg = error.message || "Error al agregar ganador";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      return NextResponse.json(data);
    }
  } catch (err) {
    console.error("POST sorteo error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
