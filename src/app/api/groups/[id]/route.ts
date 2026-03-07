import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  admin_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/groups/[id] — group detail with members + assigned campaigns
export async function GET(
  _request: NextRequest,
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

    // Fetch group
    const { data: group, error: groupError } = await supabase
      .from("seller_groups")
      .select("*, admin:admin_id(id, full_name, email)")
      .eq("id", id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 },
      );
    }

    // Fetch members
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name, email, seller_code, is_active")
      .eq("group_id", id)
      .eq("role", "seller")
      .order("full_name", { ascending: true });

    // Fetch assigned campaigns (via campaign_groups)
    const { data: campaignGroupRows } = await supabase
      .from("campaign_groups")
      .select("id, campaign_id, assigned_at, campaigns:campaign_id(id, name, slug, status)")
      .eq("group_id", id);

    const assignedCampaigns = (campaignGroupRows || []).map((cg) => ({
      assignment_id: cg.id,
      assigned_at: cg.assigned_at,
      ...(cg.campaigns as unknown as { id: string; name: string; slug: string; status: string }),
    }));

    // Fetch ALL campaigns for the assign dropdown
    const { data: allCampaigns } = await supabase
      .from("campaigns")
      .select("id, name, slug, status")
      .order("created_at", { ascending: false });

    // Fetch sellers NOT in any group (available to add)
    const { data: availableSellers } = await supabase
      .from("profiles")
      .select("id, full_name, email, seller_code, is_active")
      .eq("role", "seller")
      .is("group_id", null)
      .order("full_name", { ascending: true });

    return NextResponse.json({
      group,
      members: members || [],
      assigned_campaigns: assignedCampaigns,
      all_campaigns: allCampaigns || [],
      available_sellers: availableSellers || [],
    });
  } catch (err) {
    console.error("Group detail error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// PUT /api/groups/[id] — update group name/admin/active
export async function PUT(
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
    const parsed = updateGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.admin_id !== undefined) updates.admin_id = parsed.data.admin_id;
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const { data: group, error: updateError } = await supabase
      .from("seller_groups")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Group update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar el grupo" },
        { status: 500 },
      );
    }

    return NextResponse.json({ group });
  } catch (err) {
    console.error("Group update error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// DELETE /api/groups/[id] — hard delete (CASCADE cleans campaign_groups, SET NULL cleans profiles.group_id)
export async function DELETE(
  _request: NextRequest,
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

    // Verify group exists
    const { data: group } = await supabase
      .from("seller_groups")
      .select("id")
      .eq("id", id)
      .single();

    if (!group) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 },
      );
    }

    const { error: deleteError } = await supabase
      .from("seller_groups")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Group delete error:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar el grupo" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Group delete error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
