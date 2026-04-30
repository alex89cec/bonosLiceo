import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";

const inputSchema = z.object({
  seller_id: z.string().uuid().nullable(),
});

/**
 * PATCH /api/admin/reservations/[id]/seller
 *
 * Admin-only. Re-attributes a single bono reservation to a different
 * seller (or clears the attribution with seller_id=null).
 *
 * If the seller isn't assigned to the campaign yet, an entry is also
 * inserted into campaign_sellers so RLS for the seller works on read.
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
        { error: "Solo admins pueden cambiar el vendedor" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "seller_id inválido" },
        { status: 400 },
      );
    }
    const newSellerId = parsed.data.seller_id;

    const { data: reservation } = await service
      .from("reservations")
      .select("id, campaign_id, ticket_id")
      .eq("id", id)
      .single();
    if (!reservation) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );
    }

    // If a new seller is provided, ensure they're assigned to the campaign
    // (so they can see/manage the reservation under RLS).
    if (newSellerId) {
      const { data: assignment } = await service
        .from("campaign_sellers")
        .select("id")
        .eq("campaign_id", reservation.campaign_id)
        .eq("seller_id", newSellerId)
        .maybeSingle();

      if (!assignment) {
        await service
          .from("campaign_sellers")
          .insert({
            campaign_id: reservation.campaign_id,
            seller_id: newSellerId,
          });
      }
    }

    // Update the reservation
    const { error: updErr } = await service
      .from("reservations")
      .update({ seller_id: newSellerId })
      .eq("id", id);
    if (updErr) {
      console.error("Reservation seller update error:", updErr);
      return NextResponse.json(
        { error: "Error al actualizar la reserva" },
        { status: 500 },
      );
    }

    // Also propagate to the underlying ticket so its seller_id stays in sync
    if (reservation.ticket_id) {
      await service
        .from("tickets")
        .update({ seller_id: newSellerId })
        .eq("id", reservation.ticket_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reservation seller PATCH error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
