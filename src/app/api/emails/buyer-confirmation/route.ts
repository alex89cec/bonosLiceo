import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendBuyerConfirmationEmail, type BuyerEmailData } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    // Auth check — seller or admin
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

    if (!profile || (profile.role !== "admin" && profile.role !== "seller")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const body = await request.json();
    const reservationIds: string[] = body.reservation_ids;

    if (!reservationIds || !Array.isArray(reservationIds) || reservationIds.length === 0) {
      return NextResponse.json(
        { error: "reservation_ids es requerido (array)" },
        { status: 400 },
      );
    }

    // Use service role to fetch all related data
    const serviceClient = createServiceRoleClient();

    // Fetch reservations with related data
    const { data: reservations, error: resError } = await serviceClient
      .from("reservations")
      .select("id, ticket_id, buyer_id, campaign_id, seller_id, status")
      .in("id", reservationIds)
      .in("status", ["active", "confirmed"]);

    if (resError || !reservations || reservations.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron reservas válidas" },
        { status: 404 },
      );
    }

    // Authorization: sellers can only resend for their own reservations
    if (profile.role === "seller") {
      const unauthorized = reservations.some((r) => r.seller_id !== user.id);
      if (unauthorized) {
        return NextResponse.json(
          { error: "Solo puedes enviar emails de tus propias ventas" },
          { status: 403 },
        );
      }
    }

    // Get unique IDs
    const buyerIds = [...new Set(reservations.map((r) => r.buyer_id))];
    const campaignIds = [...new Set(reservations.map((r) => r.campaign_id))];
    const sellerIds = [...new Set(reservations.map((r) => r.seller_id))];
    const ticketIds = reservations.map((r) => r.ticket_id);

    // Fetch all related data in parallel
    const [
      { data: buyers },
      { data: campaigns },
      { data: sellers },
      { data: tickets },
      { data: payments },
    ] = await Promise.all([
      serviceClient.from("buyers").select("id, email, full_name, phone").in("id", buyerIds),
      serviceClient
        .from("campaigns")
        .select("id, name, ticket_price, flyer_url, installments_enabled, installments_count")
        .in("id", campaignIds),
      serviceClient.from("profiles").select("id, full_name, seller_code").in("id", sellerIds),
      serviceClient.from("tickets").select("id, number").in("id", ticketIds),
      serviceClient
        .from("payments")
        .select("id, reservation_id, amount, payment_mode, status")
        .in("reservation_id", reservationIds),
    ]);

    // Fetch installments for any payments
    const paymentIds = (payments || []).map((p) => p.id);
    let installments: {
      id: string;
      payment_id: string;
      number: number;
      amount: number;
      due_date: string;
      status: string;
    }[] = [];
    if (paymentIds.length > 0) {
      const { data } = await serviceClient
        .from("installments")
        .select("id, payment_id, number, amount, due_date, status")
        .in("payment_id", paymentIds)
        .order("number", { ascending: true });
      installments = data || [];
    }

    // Build lookup maps
    const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));
    const campaignMap = new Map((campaigns || []).map((c) => [c.id, c]));
    const sellerMap = new Map((sellers || []).map((s) => [s.id, s]));
    const ticketMap = new Map((tickets || []).map((t) => [t.id, t]));
    const paymentByReservation = new Map(
      (payments || []).map((p) => [p.reservation_id, p]),
    );

    // Group reservations by buyer (batch sales go to same buyer)
    const byBuyer = new Map<string, typeof reservations>();
    for (const r of reservations) {
      const group = byBuyer.get(r.buyer_id) || [];
      group.push(r);
      byBuyer.set(r.buyer_id, group);
    }

    // Send one email per buyer
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const [buyerId, buyerReservations] of byBuyer) {
      const buyer = buyerMap.get(buyerId);
      if (!buyer) continue;

      // All reservations in a buyer group should be same campaign+seller
      const firstRes = buyerReservations[0];
      const campaign = campaignMap.get(firstRes.campaign_id);
      const seller = sellerMap.get(firstRes.seller_id);
      if (!campaign || !seller) continue;

      const ticketNumbers = buyerReservations
        .map((r) => ticketMap.get(r.ticket_id)?.number)
        .filter(Boolean) as string[];

      const totalAmount = campaign.ticket_price * ticketNumbers.length;

      // Get payment info from first reservation (batch shares same payment mode)
      const payment = paymentByReservation.get(firstRes.id);
      const paymentMode = payment?.payment_mode || "full_payment";
      const paymentStatus = payment?.status || "pending";

      // Get installments if applicable
      let emailInstallments: BuyerEmailData["installments"];
      if (paymentMode === "installments" && payment) {
        emailInstallments = installments
          .filter((i) => i.payment_id === payment.id)
          .map((i) => ({
            number: i.number,
            amount: i.amount,
            due_date: i.due_date,
            status: i.status,
          }));
      }

      const emailData: BuyerEmailData = {
        buyerName: buyer.full_name,
        buyerEmail: buyer.email,
        campaignName: campaign.name,
        flyerUrl: campaign.flyer_url,
        ticketNumbers,
        ticketPrice: campaign.ticket_price,
        totalAmount,
        paymentMode: paymentMode as "full_payment" | "installments",
        paymentStatus,
        sellerName: seller.full_name,
        installments: emailInstallments,
        reservationIds: buyerReservations.map((r) => r.id),
      };

      const result = await sendBuyerConfirmationEmail(emailData);
      results.push({
        email: buyer.email,
        success: result.success,
        error: result.error,
      });
    }

    const allSuccess = results.every((r) => r.success);

    return NextResponse.json(
      {
        success: allSuccess,
        results,
        message: allSuccess
          ? "Email enviado correctamente"
          : "Algunos emails fallaron",
      },
      { status: allSuccess ? 200 : 207 },
    );
  } catch (err) {
    console.error("Buyer confirmation email error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
