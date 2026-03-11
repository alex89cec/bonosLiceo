import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { sendWelcomeEmail, sendPasswordResetEmail } from "@/lib/email";

function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;

  let password =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

// POST /api/sellers/[id]/email — send welcome or password reset email
export async function POST(
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

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!currentProfile || currentProfile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Parse action
    const body = await request.json();
    const action = body.action as string;

    if (!action || !["welcome", "reset"].includes(action)) {
      return NextResponse.json(
        { error: "Acción inválida. Usa 'welcome' o 'reset'." },
        { status: 400 },
      );
    }

    // Fetch seller profile
    const { data: seller } = await supabase
      .from("profiles")
      .select("full_name, email, seller_code, role")
      .eq("id", id)
      .single();

    if (!seller) {
      return NextResponse.json(
        { error: "Vendedor no encontrado" },
        { status: 404 },
      );
    }

    // Generate new temp password
    const newPassword = generatePassword(12);

    // Update auth password via service role
    const serviceClient = createServiceRoleClient();
    const { error: authError } =
      await serviceClient.auth.admin.updateUserById(id, {
        password: newPassword,
      });

    if (authError) {
      console.error("Auth password update error:", authError);
      return NextResponse.json(
        { error: "Error al actualizar la contraseña" },
        { status: 500 },
      );
    }

    // Set must_change_password flag
    await supabase
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", id);

    // Send email
    let emailResult;

    if (action === "welcome") {
      emailResult = await sendWelcomeEmail(
        seller.full_name,
        seller.email,
        newPassword,
        seller.seller_code || "",
      );
    } else {
      emailResult = await sendPasswordResetEmail(
        seller.full_name,
        seller.email,
        newPassword,
      );
    }

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: `Contraseña actualizada pero falló el envío del email: ${emailResult.error}`,
          password_updated: true,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        action === "welcome"
          ? "Email de bienvenida enviado"
          : "Email de reset enviado",
    });
  } catch (err) {
    console.error("Email action error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
