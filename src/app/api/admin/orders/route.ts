import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** GET /api/admin/orders?status=pending_review */
export async function GET(request: NextRequest) {
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
      .select("role, is_approver")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get("status");
    const eventId = request.nextUrl.searchParams.get("event_id");

    let query = supabase
      .from("event_orders")
      .select(
        "*, events:event_id(id, name, slug), buyers:buyer_id(email, full_name, phone), profiles:seller_id(full_name, seller_code)",
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (eventId) {
      query = query.eq("event_id", eventId);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Orders list error:", error);
      return NextResponse.json(
        { error: "Error al cargar órdenes" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      orders: orders || [],
      can_approve: profile.is_approver === true,
    });
  } catch (err) {
    console.error("Orders GET error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
