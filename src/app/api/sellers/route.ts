import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";
import { sendWelcomeEmail } from "@/lib/email";

const createSellerSchema = z.object({
  full_name: z.string().min(1, "Nombre requerido").max(200),
  email: z
    .string()
    .email("Email inválido")
    .transform((v) => v.toLowerCase().trim()),
});

function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;

  // Ensure at least one of each type
  let password =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

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

// GET /api/sellers — list all sellers
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo administradores." },
        { status: 403 },
      );
    }

    // Fetch all sellers
    const { data: sellers, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "seller")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sellers:", error);
      return NextResponse.json(
        { error: "Error al obtener vendedores" },
        { status: 500 },
      );
    }

    return NextResponse.json({ sellers: sellers ?? [] });
  } catch (err) {
    console.error("Sellers fetch error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// POST /api/sellers — create a new seller
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

    // 2. Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo administradores." },
        { status: 403 },
      );
    }

    // 3. Parse and validate body
    const body = await request.json();
    const parsed = createSellerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { full_name, email } = parsed.data;

    // 4. Check if email already exists in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 },
      );
    }

    // 5. Generate password and seller code
    const tempPassword = generatePassword(12);
    const sellerCode = generateSellerCode(full_name);

    // 6. Create auth user with service role client
    const serviceClient = createServiceRoleClient();
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: "seller",
        },
      });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "Ya existe un usuario con ese email en el sistema de autenticación" },
          { status: 409 },
        );
      }
      console.error("Auth create error:", authError);
      return NextResponse.json(
        { error: "Error al crear el usuario: " + authError.message },
        { status: 500 },
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Error al crear el usuario" },
        { status: 500 },
      );
    }

    // 7. Create profile
    const { error: profileError } = await serviceClient
      .from("profiles")
      .upsert({
        id: authData.user.id,
        role: "seller",
        full_name,
        email,
        seller_code: sellerCode,
        is_active: true,
        must_change_password: true,
      });

    if (profileError) {
      console.error("Profile create error:", profileError);
      // Try to clean up auth user
      await serviceClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Error al crear el perfil del vendedor" },
        { status: 500 },
      );
    }

    // 8. Send welcome email (non-blocking — don't fail creation if email fails)
    let emailSent = false;
    try {
      const emailResult = await sendWelcomeEmail(
        full_name,
        email,
        tempPassword,
        sellerCode,
      );
      emailSent = emailResult.success;
      if (!emailResult.success) {
        console.error("Welcome email failed:", emailResult.error);
      }
    } catch (emailErr) {
      console.error("Welcome email error:", emailErr);
    }

    return NextResponse.json(
      {
        seller: {
          id: authData.user.id,
          full_name,
          email,
          seller_code: sellerCode,
        },
        temp_password: tempPassword,
        email_sent: emailSent,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Seller creation error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
