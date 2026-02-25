import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 10;

/**
 * POST /api/campaigns/[id]/close
 * Close a campaign after the sorteo. Requires at least one winner.
 */
export async function POST(
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

    // Verify campaign exists and is active
    const { data: campaign, error: fetchError } = await serviceClient
      .from("campaigns")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    if (campaign.status !== "sorted") {
      return NextResponse.json(
        { error: "Solo se pueden cerrar campañas que ya fueron sorteadas" },
        { status: 400 },
      );
    }

    // Verify at least one winner
    const { count: winnerCount } = await serviceClient
      .from("winners")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id);

    if (!winnerCount || winnerCount === 0) {
      return NextResponse.json(
        { error: "Debe haber al menos un ganador antes de cerrar la campaña" },
        { status: 400 },
      );
    }

    // Close the campaign
    const { data: updated, error: updateError } = await serviceClient
      .from("campaigns")
      .update({ status: "closed" })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign: updated });
  } catch (err) {
    console.error("POST close error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
