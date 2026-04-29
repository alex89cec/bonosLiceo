import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";
import { emailSchema } from "@/lib/validations";

const inputSchema = z.object({
  email: emailSchema,
});

/**
 * PATCH /api/admin/reservations/[id]/buyer-email
 *
 * Admin-only. Re-links one reservation to a buyer with the new email.
 * If a buyer with that email already exists, re-uses it. Otherwise
 * creates a new buyer (copying name/phone from the previous buyer so
 * we don't lose the human's data on a typo fix).
 *
 * Other reservations of the original buyer are NOT touched.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const service = createServiceRoleClient();

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
      return NextResponse.json(
        { error: "Solo admins pueden modificar el email" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 },
      );
    }
    const newEmail = parsed.data.email;

    // Get current reservation + its buyer (for name/phone fallback)
    const { data: reservation } = await service
      .from("reservations")
      .select("id, buyer_id")
      .eq("id", id)
      .single();
    if (!reservation) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );
    }

    const { data: oldBuyer } = await service
      .from("buyers")
      .select("id, full_name, phone")
      .eq("id", reservation.buyer_id)
      .single();

    // Find buyer by email
    let { data: buyer } = await service
      .from("buyers")
      .select("id, email")
      .eq("email", newEmail)
      .maybeSingle();

    if (!buyer) {
      // Create new buyer copying the old buyer's name/phone
      const { data: newBuyer, error: createErr } = await service
        .from("buyers")
        .insert({
          email: newEmail,
          full_name: oldBuyer?.full_name || null,
          phone: oldBuyer?.phone || null,
        })
        .select("id, email")
        .single();
      if (createErr || !newBuyer) {
        console.error("Buyer create error:", createErr);
        return NextResponse.json(
          { error: "Error al crear comprador" },
          { status: 500 },
        );
      }
      buyer = newBuyer;
    }

    // Re-link reservation
    const { error: updateErr } = await service
      .from("reservations")
      .update({ buyer_id: buyer.id })
      .eq("id", id);
    if (updateErr) {
      console.error("Reservation update error:", updateErr);
      return NextResponse.json(
        { error: "Error al actualizar la reserva" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      buyer: { id: buyer.id, email: buyer.email },
    });
  } catch (err) {
    console.error("Buyer email PATCH error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
