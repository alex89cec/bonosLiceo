import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const campaignGroupSchema = z.object({
  campaign_id: z.string().uuid(),
});

// POST /api/groups/[id]/campaigns — assign campaign to group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
    const parsed = campaignGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }

    // Insert into campaign_groups (trigger auto-syncs campaign_sellers)
    const { error: insertError } = await supabase
      .from("campaign_groups")
      .insert({
        campaign_id: parsed.data.campaign_id,
        group_id: id,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Esta campaña ya está asignada a este grupo" },
          { status: 409 },
        );
      }
      console.error("Assign campaign error:", insertError);
      return NextResponse.json(
        { error: "Error al asignar campaña" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Assign campaign error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// DELETE /api/groups/[id]/campaigns — remove campaign from group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
    const parsed = campaignGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }

    // Delete from campaign_groups (trigger auto-cleans campaign_sellers)
    const { error: deleteError } = await supabase
      .from("campaign_groups")
      .delete()
      .eq("campaign_id", parsed.data.campaign_id)
      .eq("group_id", id);

    if (deleteError) {
      console.error("Remove campaign error:", deleteError);
      return NextResponse.json(
        { error: "Error al remover campaña" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove campaign error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
