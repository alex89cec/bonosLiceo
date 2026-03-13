import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";

const convertRoleSchema = z.object({
  action: z.literal("convert_role"),
  target_role: z.enum(["admin", "seller"]),
});

function generateSellerCode(name: string): string {
  const base = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  const num = String(Math.floor(Math.random() * 900) + 100);
  return (base || "SELL") + num;
}

const updateSellerSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim())
    .optional(),
  new_password: z.string().min(8).optional(),
  is_active: z.boolean().optional(),
  group_id: z.string().uuid().nullable().optional(),
  campaigns: z
    .array(
      z.object({
        campaign_id: z.string().uuid(),
        assigned: z.boolean(),
        max_tickets: z.number().int().positive().nullable(),
      }),
    )
    .optional(),
});

// GET /api/sellers/[id] — fetch seller details + campaign assignments
export async function GET(
  _request: NextRequest,
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
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!currentProfile || currentProfile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // 1. Fetch seller profile
    const { data: seller, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !seller) {
      return NextResponse.json(
        { error: "Vendedor no encontrado" },
        { status: 404 },
      );
    }

    // 2. Determine which campaigns to show
    // If seller has a group, only show campaigns assigned to their group
    // If no group, show all campaigns (legacy behavior)
    let campaignIds: string[] | null = null;

    if (seller.group_id) {
      const { data: groupCampaigns } = await supabase
        .from("campaign_groups")
        .select("campaign_id")
        .eq("group_id", seller.group_id);

      campaignIds = (groupCampaigns || []).map((gc) => gc.campaign_id);
    }

    let campaignsQuery = supabase
      .from("campaigns")
      .select("id, name, slug, status")
      .order("created_at", { ascending: false });

    if (campaignIds !== null) {
      if (campaignIds.length === 0) {
        // Group has no campaigns assigned — return empty list
        campaignsQuery = campaignsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
      } else {
        campaignsQuery = campaignsQuery.in("id", campaignIds);
      }
    }

    const { data: allCampaigns } = await campaignsQuery;

    // 3. Fetch campaign assignments for this seller
    const { data: assignments } = await supabase
      .from("campaign_sellers")
      .select("id, campaign_id, max_tickets, assigned_at")
      .eq("seller_id", id);

    // 4. Count reservations per campaign for this seller
    const { data: ticketCounts } = await supabase
      .from("reservations")
      .select("campaign_id")
      .eq("seller_id", id)
      .in("status", ["active", "confirmed"]);

    const countMap: Record<string, number> = {};
    ticketCounts?.forEach((r) => {
      countMap[r.campaign_id] = (countMap[r.campaign_id] || 0) + 1;
    });

    // 5. Build assignment map for quick lookup
    const assignmentMap: Record<string, { id: string; max_tickets: number | null; assigned_at: string }> = {};
    (assignments || []).forEach((a) => {
      assignmentMap[a.campaign_id] = {
        id: a.id,
        max_tickets: a.max_tickets,
        assigned_at: a.assigned_at,
      };
    });

    // 6. Build enriched campaigns list
    const enrichedCampaigns = (allCampaigns || []).map((c) => {
      const assignment = assignmentMap[c.id];
      return {
        campaign_id: c.id,
        campaign_name: c.name,
        campaign_slug: c.slug,
        campaign_status: c.status,
        assigned: !!assignment,
        assignment_id: assignment?.id || null,
        max_tickets: assignment?.max_tickets ?? null,
        assigned_at: assignment?.assigned_at || null,
        sold_count: countMap[c.id] || 0,
      };
    });

    // 7. Fetch available groups for selector
    const { data: groupsList } = await supabase
      .from("seller_groups")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    return NextResponse.json({
      seller,
      campaigns: enrichedCampaigns,
      groups: groupsList || [],
      current_user_id: user.id,
    });
  } catch (err) {
    console.error("Seller fetch error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// PUT /api/sellers/[id] — update seller profile, password, and campaign limits
export async function PUT(
  request: NextRequest,
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
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!currentProfile || currentProfile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const parsed = updateSellerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { full_name, email, new_password, is_active, group_id, campaigns } =
      parsed.data;

    const serviceClient = createServiceRoleClient();

    // 1. Update profile fields
    const profileUpdate: Record<string, unknown> = {};
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (email !== undefined) profileUpdate.email = email;
    if (is_active !== undefined) profileUpdate.is_active = is_active;
    if (group_id !== undefined) profileUpdate.group_id = group_id;

    if (Object.keys(profileUpdate).length > 0) {
      // Check email uniqueness if changing
      if (email) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .neq("id", id)
          .single();

        if (existingProfile) {
          return NextResponse.json(
            { error: "Ya existe un usuario con ese email" },
            { status: 409 },
          );
        }
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", id);

      if (profileError) {
        console.error("Profile update error:", profileError);
        return NextResponse.json(
          { error: "Error al actualizar el perfil" },
          { status: 500 },
        );
      }
    }

    // 2. Update auth email if changed
    if (email) {
      const { error: emailError } =
        await serviceClient.auth.admin.updateUserById(id, { email });
      if (emailError) {
        console.error("Auth email update error:", emailError);
      }
    }

    // 3. Update password if provided
    if (new_password) {
      const { error: pwError } =
        await serviceClient.auth.admin.updateUserById(id, {
          password: new_password,
        });
      if (pwError) {
        console.error("Auth password update error:", pwError);
        return NextResponse.json(
          { error: "Error al actualizar la contraseña" },
          { status: 500 },
        );
      }
      // Clear must_change_password flag
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", id);
    }

    // 4. Update campaign assignments (assign/unassign + limits)
    if (campaigns && campaigns.length > 0) {
      for (const c of campaigns) {
        if (c.assigned) {
          // Upsert: assign campaign and set max_tickets
          await supabase
            .from("campaign_sellers")
            .upsert(
              {
                campaign_id: c.campaign_id,
                seller_id: id,
                max_tickets: c.max_tickets,
              },
              { onConflict: "campaign_id,seller_id" },
            );
        } else {
          // Before unassigning, check if seller has active/confirmed reservations
          const { count: activeReservations } = await supabase
            .from("reservations")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", id)
            .eq("campaign_id", c.campaign_id)
            .in("status", ["active", "confirmed"]);

          if (activeReservations && activeReservations > 0) {
            return NextResponse.json(
              {
                error: `No se puede desasignar la campaña porque el vendedor tiene ${activeReservations} reserva(s) activa(s)`,
                campaign_id: c.campaign_id,
              },
              { status: 409 },
            );
          }

          // Safe to unassign
          await supabase
            .from("campaign_sellers")
            .delete()
            .eq("campaign_id", c.campaign_id)
            .eq("seller_id", id);
        }
      }
    }

    // Fetch updated seller
    const { data: updatedSeller } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ seller: updatedSeller });
  } catch (err) {
    console.error("Seller update error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// DELETE /api/sellers/[id] — soft-delete (deactivate + remove from group)
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

    // Prevent self-deletion
    if (id === user.id) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propia cuenta" },
        { status: 400 },
      );
    }

    // Check for active reservations in active campaigns
    const { data: activeReservations } = await supabase
      .from("reservations")
      .select("campaign_id, campaigns:campaign_id(name, status)")
      .eq("seller_id", id)
      .in("status", ["active", "confirmed"]);

    const blockingReservations = (activeReservations || []).filter(
      (r: Record<string, unknown>) => {
        const campaign = r.campaigns as Record<string, unknown> | null;
        return campaign?.status === "active";
      },
    );

    if (blockingReservations.length > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede desactivar: tiene reservaciones activas en campañas activas",
        },
        { status: 409 },
      );
    }

    // Soft delete: deactivate and remove from group
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: false, group_id: null })
      .eq("id", id);

    if (updateError) {
      console.error("Seller delete error:", updateError);
      return NextResponse.json(
        { error: "Error al desactivar el vendedor" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Seller delete error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// PATCH /api/sellers/[id] — convert role (seller ↔ admin)
export async function PATCH(
  request: NextRequest,
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
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!currentProfile || currentProfile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const parsed = convertRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }

    const { target_role } = parsed.data;

    // Prevent self-conversion
    if (id === user.id) {
      return NextResponse.json(
        { error: "No puedes convertir tu propia cuenta" },
        { status: 400 },
      );
    }

    // Fetch target profile
    const { data: targetProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role, group_id, seller_code, full_name")
      .eq("id", id)
      .single();

    if (fetchError || !targetProfile) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    // Can't convert if already that role
    if (targetProfile.role === target_role) {
      return NextResponse.json(
        { error: "El usuario ya tiene el rol solicitado" },
        { status: 400 },
      );
    }

    // Seller → Admin: block if has a group
    if (targetProfile.role === "seller" && targetProfile.group_id !== null) {
      return NextResponse.json(
        {
          error:
            "No se puede convertir: el vendedor pertenece a un grupo. Remuévalo del grupo primero.",
        },
        { status: 409 },
      );
    }

    // Both directions: block if has active/confirmed reservations in active campaigns
    const { data: activeReservations } = await supabase
      .from("reservations")
      .select("campaign_id, campaigns:campaign_id(name, status)")
      .eq("seller_id", id)
      .in("status", ["active", "confirmed"]);

    const blockingReservations = (activeReservations || []).filter(
      (r: Record<string, unknown>) => {
        const campaign = r.campaigns as Record<string, unknown> | null;
        return campaign?.status === "active";
      },
    );

    if (blockingReservations.length > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede convertir: tiene reservaciones activas en campañas activas",
        },
        { status: 409 },
      );
    }

    const serviceClient = createServiceRoleClient();
    const profileUpdate: Record<string, unknown> = { role: target_role };

    if (target_role === "seller") {
      // Admin → Seller: remove from all campaign_sellers (admin was auto-assigned)
      await serviceClient
        .from("campaign_sellers")
        .delete()
        .eq("seller_id", id);

      // Generate seller_code if null
      if (!targetProfile.seller_code) {
        profileUpdate.seller_code = generateSellerCode(
          targetProfile.full_name,
        );
      }
    }

    // Update profile role
    // For seller→admin: DB trigger trg_auto_assign_admin_to_campaigns fires automatically
    const { error: updateError } = await serviceClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", id);

    if (updateError) {
      console.error("Role conversion error:", updateError);
      return NextResponse.json(
        { error: "Error al convertir el rol" },
        { status: 500 },
      );
    }

    // Update auth user_metadata.role for consistency
    await serviceClient.auth.admin.updateUserById(id, {
      user_metadata: { role: target_role },
    });

    // Fetch updated profile
    const { data: updatedSeller } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ seller: updatedSeller });
  } catch (err) {
    console.error("Role conversion error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
