import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** GET /api/admin/seller-options — lightweight list of active sellers/admins
 *  for the seller picker in reports. Admin-only.
 */
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

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, seller_code, role")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Seller options error:", error);
      return NextResponse.json(
        { error: "Error al cargar vendedores" },
        { status: 500 },
      );
    }

    return NextResponse.json({ sellers: data || [] });
  } catch (err) {
    console.error("Seller options GET error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
