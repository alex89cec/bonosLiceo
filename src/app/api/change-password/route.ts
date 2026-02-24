import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const changePasswordSchema = z.object({
  new_password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // 3. Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    });

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json(
        { error: "Error al cambiar la contraseña: " + updateError.message },
        { status: 500 },
      );
    }

    // 4. Clear must_change_password flag
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Password was changed successfully, so we don't return error
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
