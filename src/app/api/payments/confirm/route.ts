import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";

const confirmSchema = z.object({
  reservation_id: z.string().uuid("ID de reserva inválido"),
  installment_number: z.number().int().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Verify seller or admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["seller", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // 3. Parse body
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { reservation_id, installment_number } = parsed.data;

    // 4. Use service role client for write operations
    const serviceClient = createServiceRoleClient();

    // 5. Get reservation and verify ownership
    const { data: reservation, error: resError } = await serviceClient
      .from("reservations")
      .select("id, status, ticket_id, seller_id")
      .eq("id", reservation_id)
      .single();

    if (resError || !reservation) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );
    }

    // Seller can only confirm their own reservations (admin can confirm any)
    if (reservation.seller_id !== user.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    if (!["active", "confirmed"].includes(reservation.status)) {
      return NextResponse.json(
        { error: "La reserva no está en un estado confirmable" },
        { status: 400 },
      );
    }

    // 6. Get payment
    const { data: payment, error: payError } = await serviceClient
      .from("payments")
      .select("id, payment_mode, status")
      .eq("reservation_id", reservation_id)
      .single();

    if (payError || !payment) {
      return NextResponse.json(
        { error: "Pago no encontrado" },
        { status: 404 },
      );
    }

    if (payment.status === "completed") {
      return NextResponse.json(
        { error: "El pago ya está completado" },
        { status: 400 },
      );
    }

    // 7. Process based on payment mode
    if (payment.payment_mode === "full_payment") {
      // Mark payment as completed
      await serviceClient
        .from("payments")
        .update({ status: "completed" })
        .eq("id", payment.id);

      // Mark reservation as confirmed
      await serviceClient
        .from("reservations")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", reservation_id);

      // Mark ticket as sold
      await serviceClient
        .from("tickets")
        .update({ status: "sold" })
        .eq("id", reservation.ticket_id);

      return NextResponse.json({
        success: true,
        payment_status: "completed",
        reservation_status: "confirmed",
      });
    } else if (payment.payment_mode === "installments") {
      if (!installment_number) {
        return NextResponse.json(
          { error: "Número de cuota requerido para pagos en cuotas" },
          { status: 400 },
        );
      }

      // Mark specific installment as paid
      const { data: updatedInstallment, error: instError } = await serviceClient
        .from("installments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("payment_id", payment.id)
        .eq("number", installment_number)
        .neq("status", "paid")
        .select("id")
        .single();

      if (instError || !updatedInstallment) {
        return NextResponse.json(
          { error: "Cuota no encontrada o ya está pagada" },
          { status: 400 },
        );
      }

      // Check if all installments are now paid
      const { count: unpaidCount } = await serviceClient
        .from("installments")
        .select("id", { count: "exact", head: true })
        .eq("payment_id", payment.id)
        .neq("status", "paid");

      const allPaid = (unpaidCount ?? 0) === 0;

      // Update payment status
      await serviceClient
        .from("payments")
        .update({ status: allPaid ? "completed" : "partial" })
        .eq("id", payment.id);

      // Confirm reservation on first payment (if still active)
      if (reservation.status === "active") {
        await serviceClient
          .from("reservations")
          .update({
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", reservation_id);
      }

      // If all paid, mark ticket as sold
      if (allPaid) {
        await serviceClient
          .from("tickets")
          .update({ status: "sold" })
          .eq("id", reservation.ticket_id);
      }

      return NextResponse.json({
        success: true,
        payment_status: allPaid ? "completed" : "partial",
        reservation_status: allPaid
          ? "confirmed"
          : reservation.status === "active"
            ? "confirmed"
            : reservation.status,
        installment_number,
      });
    }

    return NextResponse.json(
      { error: "Modo de pago no reconocido" },
      { status: 400 },
    );
  } catch (err) {
    console.error("Payment confirmation error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
