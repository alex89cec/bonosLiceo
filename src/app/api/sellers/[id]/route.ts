import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";

const updateSellerSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim())
    .optional(),
  new_password: z.string().min(8).optional(),
  is_active: z.boolean().optional(),
  assignments: z
    .array(
      z.object({
        campaign_id: z.string().uuid(),
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

    // 2. Fetch campaign assignments with campaign details
    const { data: assignments } = await supabase
      .from("campaign_sellers")
      .select(
        `
        id,
        campaign_id,
        max_tickets,
        assigned_at,
        campaigns:campaign_id (id, name, slug, status)
      `,
      )
      .eq("seller_id", id);

    // 3. Count reservations per campaign for this seller
    const { data: ticketCounts } = await supabase
      .from("reservations")
      .select("campaign_id")
      .eq("seller_id", id)
      .in("status", ["active", "confirmed"]);

    const countMap: Record<string, number> = {};
    ticketCounts?.forEach((r) => {
      countMap[r.campaign_id] = (countMap[r.campaign_id] || 0) + 1;
    });

    // 4. Enrich assignments with sold_count
    const enrichedAssignments = (assignments || []).map((a) => ({
      ...a,
      sold_count: countMap[a.campaign_id] || 0,
    }));

    return NextResponse.json({
      seller,
      assignments: enrichedAssignments,
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
          error: "Datos invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { full_name, email, new_password, is_active, assignments } =
      parsed.data;

    const serviceClient = createServiceRoleClient();

    // 1. Update profile fields
    const profileUpdate: Record<string, unknown> = {};
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (email !== undefined) profileUpdate.email = email;
    if (is_active !== undefined) profileUpdate.is_active = is_active;

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
          { error: "Error al actualizar la contrasena" },
          { status: 500 },
        );
      }
      // Clear must_change_password flag
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", id);
    }

    // 4. Update campaign assignment limits
    if (assignments && assignments.length > 0) {
      for (const a of assignments) {
        await supabase
          .from("campaign_sellers")
          .update({ max_tickets: a.max_tickets })
          .eq("campaign_id", a.campaign_id)
          .eq("seller_id", id);
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
