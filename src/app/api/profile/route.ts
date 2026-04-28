import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validations";

/** GET /api/profile — current user's profile + group info */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, role, full_name, email, phone, seller_code, is_active, is_approver, group_id, must_change_password, created_at, seller_groups:group_id(id, name)",
      )
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: "Perfil no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/** PUT /api/profile — update name/phone/seller_code on the current user */
export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const updates = parsed.data;

    // Service role for the uniqueness check (sellers can only read their own
    // profile via RLS, so we need to bypass to check seller_code globally).
    const service = createServiceRoleClient();

    // Fetch current profile so we can compute history changes
    const { data: currentProfile } = await service
      .from("profiles")
      .select("seller_code, seller_code_history")
      .eq("id", user.id)
      .single();

    if (updates.seller_code !== undefined && currentProfile) {
      const newCode = updates.seller_code;
      const currentCode = currentProfile.seller_code;
      const currentHistory: string[] =
        (currentProfile.seller_code_history as string[] | null) || [];

      // No-op if same code
      if (newCode !== currentCode) {
        // Reject if the new code matches another user's CURRENT code
        const { data: currentClash } = await service
          .from("profiles")
          .select("id")
          .eq("seller_code", newCode)
          .neq("id", user.id)
          .maybeSingle();

        if (currentClash) {
          return NextResponse.json(
            { error: "Ese código ya está en uso por otro usuario" },
            { status: 409 },
          );
        }

        // Reject if the new code is in another user's HISTORY
        // (so we don't clash with an old share link of theirs)
        const { data: historyClash } = await service
          .from("profiles")
          .select("id")
          .contains("seller_code_history", [newCode])
          .neq("id", user.id)
          .maybeSingle();

        if (historyClash) {
          return NextResponse.json(
            {
              error:
                "Ese código fue usado antes por otro usuario. Elegí otro distinto.",
            },
            { status: 409 },
          );
        }
      }
    }

    const writableUpdates: Record<string, unknown> = {};
    if (updates.full_name !== undefined)
      writableUpdates.full_name = updates.full_name.trim();
    if (updates.phone !== undefined)
      writableUpdates.phone = updates.phone?.trim() || null;

    // Handle seller_code change: push old code to history (de-duped)
    if (updates.seller_code !== undefined && currentProfile) {
      const newCode = updates.seller_code;
      const currentCode = currentProfile.seller_code;
      if (newCode !== currentCode) {
        writableUpdates.seller_code = newCode;

        const existingHistory: string[] =
          (currentProfile.seller_code_history as string[] | null) || [];
        const additions: string[] = [];
        // Add the previous current code (if any) if not already in history
        if (currentCode && !existingHistory.includes(currentCode)) {
          additions.push(currentCode);
        }
        // Remove the new code from history if it was there (since it's now current)
        const newHistory = existingHistory
          .filter((c) => c !== newCode)
          .concat(additions);
        writableUpdates.seller_code_history = newHistory;
      }
    }

    if (Object.keys(writableUpdates).length === 0) {
      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
    }

    const { data: updated, error } = await service
      .from("profiles")
      .update(writableUpdates)
      .eq("id", user.id)
      .select(
        "id, role, full_name, email, phone, seller_code, is_active, is_approver, group_id",
      )
      .single();

    if (error) {
      // Catch unique violation just in case
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ese código ya está en uso por otro usuario" },
          { status: 409 },
        );
      }
      console.error("Profile update error:", error);
      return NextResponse.json(
        { error: "Error al actualizar el perfil" },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile: updated });
  } catch (err) {
    console.error("Profile PUT error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
