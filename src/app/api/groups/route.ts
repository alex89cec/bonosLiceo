import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { groupSchema } from "@/lib/validations";

// GET /api/groups — list all groups with member count + campaign count
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

    // Fetch groups with admin info
    const { data: groups, error: groupsError } = await supabase
      .from("seller_groups")
      .select("*, admin:admin_id(full_name, email)")
      .order("created_at", { ascending: false });

    if (groupsError) {
      console.error("Groups fetch error:", groupsError);
      return NextResponse.json(
        { error: "Error al cargar los grupos" },
        { status: 500 },
      );
    }

    // Count members per group
    const { data: members } = await supabase
      .from("profiles")
      .select("group_id")
      .not("group_id", "is", null)
      .eq("role", "seller");

    const memberCounts: Record<string, number> = {};
    members?.forEach((m) => {
      if (m.group_id) {
        memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
      }
    });

    // Count campaigns per group
    const { data: campaignGroups } = await supabase
      .from("campaign_groups")
      .select("group_id");

    const campaignCounts: Record<string, number> = {};
    campaignGroups?.forEach((cg) => {
      campaignCounts[cg.group_id] = (campaignCounts[cg.group_id] || 0) + 1;
    });

    const enriched = (groups || []).map((g) => ({
      ...g,
      member_count: memberCounts[g.id] || 0,
      campaign_count: campaignCounts[g.id] || 0,
    }));

    // Also fetch admins for the create form dropdown
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "admin")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    return NextResponse.json({ groups: enriched, admins: adminProfiles || [] });
  } catch (err) {
    console.error("Groups list error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// POST /api/groups — create a new group
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = groupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { data: group, error: insertError } = await supabase
      .from("seller_groups")
      .insert({
        name: parsed.data.name,
        admin_id: parsed.data.admin_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Group create error:", insertError);
      return NextResponse.json(
        { error: "Error al crear el grupo" },
        { status: 500 },
      );
    }

    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    console.error("Group create error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
