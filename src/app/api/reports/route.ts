import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  CampaignReport,
  CampaignSellerBreakdown,
  SellerReport,
  SellerCampaignBreakdown,
  GroupReport,
  GroupMemberBreakdown,
  SummaryReport,
  SummaryCampaign,
  SummaryCampaignReservation,
} from "@/types/reports";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Auth check
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

    const tab = request.nextUrl.searchParams.get("tab") || "summary";
    const statusFilter = request.nextUrl.searchParams.get("status") || "all";

    // ── Shared base data ──
    // Use reservations (actual sales) instead of tickets (pre-generated grid)
    // Reservations table is small; tickets table has 100k+ rows per campaign
    const [
      { data: campaigns },
      { data: reservations },
      { data: payments },
      { data: installments },
      { data: profiles },
      { data: campaignSellers },
      { data: campaignGroups },
      { data: groups },
      { data: buyers },
    ] = await Promise.all([
      supabase.from("campaigns").select("id, name, status, ticket_price, number_from, number_to"),
      supabase.from("reservations").select("id, campaign_id, seller_id, buyer_id, ticket_id, status"),
      supabase.from("payments").select("id, campaign_id, reservation_id, amount, status"),
      supabase.from("installments").select("id, payment_id, amount, status, due_date"),
      supabase.from("profiles").select("id, full_name, email, role, seller_code, group_id, is_active").in("role", ["seller", "admin"]),
      supabase.from("campaign_sellers").select("campaign_id, seller_id"),
      supabase.from("campaign_groups").select("campaign_id, group_id"),
      supabase.from("seller_groups").select("id, name, color, admin_id"),
      supabase.from("buyers").select("id, email, full_name"),
    ]);

    const allCampaigns = campaigns || [];
    const allReservations = reservations || [];
    const allPayments = payments || [];
    const allInstallments = installments || [];
    const allProfiles = profiles || [];
    const allCampaignSellers = campaignSellers || [];
    const allCampaignGroups = campaignGroups || [];
    const allBuyers = buyers || [];

    // Fetch ticket numbers for reservations (only the reserved/sold ones, not all 100k)
    const reservationTicketIds = allReservations
      .filter((r) => r.status === "active" || r.status === "confirmed")
      .map((r) => r.ticket_id)
      .filter(Boolean);
    let ticketNumberMap = new Map<string, string>();
    if (reservationTicketIds.length > 0) {
      const { data: ticketRows } = await supabase
        .from("tickets")
        .select("id, number")
        .in("id", reservationTicketIds);
      for (const t of ticketRows || []) {
        ticketNumberMap.set(t.id, t.number);
      }
    }

    // Buyer lookup
    const buyerMap = new Map(allBuyers.map((b) => [b.id, b]));
    const allGroups = groups || [];

    // Filter campaigns by status if requested
    const filteredCampaigns =
      statusFilter === "all"
        ? allCampaigns
        : allCampaigns.filter((c) => c.status === statusFilter);
    const filteredCampaignIds = new Set(filteredCampaigns.map((c) => c.id));

    // Build reservation→seller map
    const reservationSellerMap = new Map<string, string>();
    for (const r of allReservations) {
      reservationSellerMap.set(r.id, r.seller_id);
    }

    // Build payment→seller map
    const paymentSellerMap = new Map<string, string>();
    for (const p of allPayments) {
      const sellerId = reservationSellerMap.get(p.reservation_id);
      if (sellerId) paymentSellerMap.set(p.id, sellerId);
    }

    // Helper: count reservations as "sold" (reservations represent actual sales/reservations)
    // A reservation with status "active" or "confirmed" = taken number
    function countTaken(campaignId: string, sellerId?: string) {
      return allReservations.filter(
        (r) =>
          r.campaign_id === campaignId &&
          (r.status === "active" || r.status === "confirmed") &&
          (sellerId ? r.seller_id === sellerId : true)
      ).length;
    }

    function countByStatus(campaignId: string, status: string, sellerId?: string) {
      return allReservations.filter(
        (r) =>
          r.campaign_id === campaignId &&
          r.status === status &&
          (sellerId ? r.seller_id === sellerId : true)
      ).length;
    }

    // ── TAB: summary ──
    if (tab === "summary") {
      let totalExpected = 0;
      let totalConfirmed = 0;
      let totalPending = 0;
      let totalNumbers = 0;
      let totalSold = 0;

      const summaryCampaigns: SummaryCampaign[] = [];

      for (const c of filteredCampaigns) {
        const total = c.number_to - c.number_from + 1;
        const taken = countTaken(c.id);
        const confirmed = countByStatus(c.id, "confirmed");
        const active = countByStatus(c.id, "active");
        const expected = taken * c.ticket_price;

        const cPayments = allPayments.filter((p) => p.campaign_id === c.id);
        const confirmedAmount = cPayments
          .filter((p) => p.status === "completed")
          .reduce((s, p) => s + p.amount, 0);

        const partialPaymentIds = new Set(
          cPayments.filter((p) => p.status === "partial").map((p) => p.id)
        );
        const paidInstallments = allInstallments
          .filter((i) => partialPaymentIds.has(i.payment_id) && i.status === "paid")
          .reduce((s, i) => s + i.amount, 0);

        const totalConfirmedForCampaign = confirmedAmount + paidInstallments;
        const pending = expected - totalConfirmedForCampaign;

        totalExpected += expected;
        totalConfirmed += totalConfirmedForCampaign;
        totalPending += pending;
        totalNumbers += total;
        totalSold += taken;

        // Build reservation details for this campaign
        const campaignReservations: SummaryCampaignReservation[] = allReservations
          .filter(
            (r) =>
              r.campaign_id === c.id &&
              (r.status === "active" || r.status === "confirmed")
          )
          .map((r) => {
            const seller = allProfiles.find((p) => p.id === r.seller_id);
            const buyer = buyerMap.get(r.buyer_id);
            const payment = allPayments.find((p) => p.reservation_id === r.id);
            return {
              ticket_number: ticketNumberMap.get(r.ticket_id) || "—",
              seller_name: seller?.full_name || "—",
              seller_code: seller?.seller_code || null,
              buyer_email: buyer?.email || "—",
              buyer_name: buyer?.full_name || null,
              status: r.status,
              payment_status: payment?.status || "pending",
            };
          })
          .sort((a, b) => a.ticket_number.localeCompare(b.ticket_number));

        summaryCampaigns.push({
          id: c.id,
          name: c.name,
          status: c.status,
          total,
          sold: confirmed,
          reserved: active,
          percent: total > 0 ? (taken / total) * 100 : 0,
          reservations: campaignReservations,
        });
      }

      // Overdue installments
      const allPaymentIds = new Set(
        allPayments.filter((p) => filteredCampaignIds.has(p.campaign_id)).map((p) => p.id)
      );
      const now = new Date().toISOString().split("T")[0];
      const overdue = allInstallments.filter(
        (i) =>
          allPaymentIds.has(i.payment_id) &&
          (i.status === "overdue" || (i.status === "pending" && i.due_date < now))
      );

      const result: SummaryReport = {
        total_expected: totalExpected,
        total_confirmed: totalConfirmed,
        total_pending: totalPending,
        total_numbers: totalNumbers,
        total_sold: totalSold,
        total_reserved: 0,
        overdue_count: overdue.length,
        overdue_amount: overdue.reduce((s, i) => s + i.amount, 0),
        campaigns: summaryCampaigns,
      };

      return NextResponse.json(result);
    }

    // ── TAB: campaigns ──
    if (tab === "campaigns") {
      const result: CampaignReport[] = [];

      for (const c of filteredCampaigns) {
        const total = c.number_to - c.number_from + 1;
        const taken = countTaken(c.id);
        const confirmed = countByStatus(c.id, "confirmed");
        const active = countByStatus(c.id, "active");
        const available = total - taken;
        const expected = taken * c.ticket_price;

        const cPayments = allPayments.filter((p) => p.campaign_id === c.id);
        const confirmedAmount = cPayments
          .filter((p) => p.status === "completed")
          .reduce((s, p) => s + p.amount, 0);

        const partialPaymentIds = new Set(
          cPayments.filter((p) => p.status === "partial").map((p) => p.id)
        );
        const paidInstallments = allInstallments
          .filter((i) => partialPaymentIds.has(i.payment_id) && i.status === "paid")
          .reduce((s, i) => s + i.amount, 0);

        const allCPaymentIds = new Set(cPayments.map((p) => p.id));
        const now = new Date().toISOString().split("T")[0];
        const overdueList = allInstallments.filter(
          (i) =>
            allCPaymentIds.has(i.payment_id) &&
            (i.status === "overdue" || (i.status === "pending" && i.due_date < now))
        );

        // Per-seller breakdown using reservations
        const sellerMap = new Map<string, CampaignSellerBreakdown>();
        for (const r of allReservations) {
          if (r.campaign_id !== c.id) continue;
          if (r.status !== "active" && r.status !== "confirmed") continue;
          if (!sellerMap.has(r.seller_id)) {
            const p = allProfiles.find((pr) => pr.id === r.seller_id);
            sellerMap.set(r.seller_id, {
              id: r.seller_id,
              name: p?.full_name || "—",
              code: p?.seller_code || null,
              reserved: 0,
              sold: 0,
              confirmed_amount: 0,
              pending_amount: 0,
            });
          }
          const entry = sellerMap.get(r.seller_id)!;
          if (r.status === "active") entry.reserved++;
          if (r.status === "confirmed") entry.sold++;
        }

        // Add payment amounts per seller
        for (const p of cPayments) {
          const sellerId = paymentSellerMap.get(p.id);
          if (!sellerId || !sellerMap.has(sellerId)) continue;
          const entry = sellerMap.get(sellerId)!;
          if (p.status === "completed") {
            entry.confirmed_amount += p.amount;
          } else {
            const paidInst = allInstallments
              .filter((i) => i.payment_id === p.id && i.status === "paid")
              .reduce((s, i) => s + i.amount, 0);
            entry.confirmed_amount += paidInst;
            entry.pending_amount += p.amount - paidInst;
          }
        }

        result.push({
          id: c.id,
          name: c.name,
          status: c.status,
          ticket_price: c.ticket_price,
          total_numbers: total,
          available,
          reserved: active,
          sold: confirmed,
          percent_sold: total > 0 ? (taken / total) * 100 : 0,
          expected_amount: expected,
          confirmed_amount: confirmedAmount + paidInstallments,
          partial_amount: paidInstallments,
          pending_amount: expected - confirmedAmount - paidInstallments,
          overdue_installments: overdueList.length,
          overdue_amount: overdueList.reduce((s, i) => s + i.amount, 0),
          sellers: Array.from(sellerMap.values()).sort((a, b) => (b.sold + b.reserved) - (a.sold + a.reserved)),
        });
      }

      return NextResponse.json(result);
    }

    // ── TAB: sellers ──
    if (tab === "sellers") {
      const result: SellerReport[] = [];

      for (const seller of allProfiles) {
        // Campaigns assigned
        const assigned = allCampaignSellers
          .filter((cs) => cs.seller_id === seller.id)
          .map((cs) => cs.campaign_id)
          .filter((cid) => filteredCampaignIds.has(cid));

        // Reservations by this seller in filtered campaigns
        const sellerReservations = allReservations.filter(
          (r) =>
            r.seller_id === seller.id &&
            filteredCampaignIds.has(r.campaign_id) &&
            (r.status === "active" || r.status === "confirmed")
        );
        const totalReserved = sellerReservations.filter((r) => r.status === "active").length;
        const totalSold = sellerReservations.filter((r) => r.status === "confirmed").length;

        // Payments for this seller
        const sellerPayments = allPayments.filter((p) => {
          const rSellerId = reservationSellerMap.get(p.reservation_id);
          return rSellerId === seller.id && filteredCampaignIds.has(p.campaign_id);
        });

        let confirmedTotal = 0;
        let expectedTotal = 0;

        // Per-campaign breakdown
        const campaignBreakdowns: SellerCampaignBreakdown[] = [];
        const relevantCampaignIds = new Set([
          ...assigned,
          ...sellerReservations.map((r) => r.campaign_id),
        ]);

        for (const cid of relevantCampaignIds) {
          const campaign = allCampaigns.find((c) => c.id === cid);
          if (!campaign) continue;

          const cReservations = sellerReservations.filter((r) => r.campaign_id === cid);
          const cReserved = cReservations.filter((r) => r.status === "active").length;
          const cSold = cReservations.filter((r) => r.status === "confirmed").length;
          const cExpected = (cReserved + cSold) * campaign.ticket_price;

          const cPayments = sellerPayments.filter((p) => p.campaign_id === cid);
          let cConfirmed = cPayments
            .filter((p) => p.status === "completed")
            .reduce((s, p) => s + p.amount, 0);

          const partialIds = new Set(
            cPayments.filter((p) => p.status === "partial").map((p) => p.id)
          );
          const paidInst = allInstallments
            .filter((i) => partialIds.has(i.payment_id) && i.status === "paid")
            .reduce((s, i) => s + i.amount, 0);
          cConfirmed += paidInst;

          confirmedTotal += cConfirmed;
          expectedTotal += cExpected;

          campaignBreakdowns.push({
            id: cid,
            name: campaign.name,
            status: campaign.status,
            reserved: cReserved,
            sold: cSold,
            confirmed_amount: cConfirmed,
            pending_amount: cExpected - cConfirmed,
          });
        }

        // Only include sellers with assignments or sales
        if (assigned.length === 0 && sellerReservations.length === 0) continue;

        const group = allGroups.find((g) => g.id === seller.group_id);

        result.push({
          id: seller.id,
          name: seller.full_name,
          code: seller.seller_code,
          email: seller.email,
          role: seller.role,
          group_name: group?.name || null,
          group_color: group?.color || null,
          campaigns_assigned: assigned.length,
          total_reserved: totalReserved,
          total_sold: totalSold,
          expected_amount: expectedTotal,
          confirmed_amount: confirmedTotal,
          pending_amount: expectedTotal - confirmedTotal,
          campaigns: campaignBreakdowns.sort((a, b) => (b.sold + b.reserved) - (a.sold + a.reserved)),
        });
      }

      result.sort((a, b) => (b.total_sold + b.total_reserved) - (a.total_sold + a.total_reserved));
      return NextResponse.json(result);
    }

    // ── TAB: groups ──
    if (tab === "groups") {
      const result: GroupReport[] = [];

      for (const group of allGroups) {
        const admin = allProfiles.find((p) => p.id === group.admin_id);
        const members = allProfiles.filter((p) => p.group_id === group.id);
        const memberIds = new Set(members.map((m) => m.id));

        // Campaigns assigned to this group
        const groupCampaignIds = allCampaignGroups
          .filter((cg) => cg.group_id === group.id)
          .map((cg) => cg.campaign_id)
          .filter((cid) => filteredCampaignIds.has(cid));

        // All reservations by group members in filtered campaigns
        const groupReservations = allReservations.filter(
          (r) =>
            memberIds.has(r.seller_id) &&
            filteredCampaignIds.has(r.campaign_id) &&
            (r.status === "active" || r.status === "confirmed")
        );
        const totalTaken = groupReservations.length;

        // Payments by group members
        const groupPayments = allPayments.filter((p) => {
          const sellerId = paymentSellerMap.get(p.id);
          return sellerId && memberIds.has(sellerId) && filteredCampaignIds.has(p.campaign_id);
        });

        let confirmedTotal = 0;
        let expectedTotal = 0;

        for (const c of filteredCampaigns) {
          const cRes = groupReservations.filter((r) => r.campaign_id === c.id).length;
          expectedTotal += cRes * c.ticket_price;
        }

        for (const p of groupPayments) {
          if (p.status === "completed") {
            confirmedTotal += p.amount;
          } else if (p.status === "partial") {
            const paidInst = allInstallments
              .filter((i) => i.payment_id === p.id && i.status === "paid")
              .reduce((s, i) => s + i.amount, 0);
            confirmedTotal += paidInst;
          }
        }

        // Member leaderboard
        const memberBreakdowns: GroupMemberBreakdown[] = [];
        for (const m of members) {
          const mReservations = groupReservations.filter((r) => r.seller_id === m.id);
          const mTaken = mReservations.length;

          const mPayments = groupPayments.filter((p) => paymentSellerMap.get(p.id) === m.id);
          let mConfirmed = mPayments
            .filter((p) => p.status === "completed")
            .reduce((s, p) => s + p.amount, 0);
          const partialIds = new Set(
            mPayments.filter((p) => p.status === "partial").map((p) => p.id)
          );
          mConfirmed += allInstallments
            .filter((i) => partialIds.has(i.payment_id) && i.status === "paid")
            .reduce((s, i) => s + i.amount, 0);

          let mExpected = 0;
          for (const c of filteredCampaigns) {
            const ct = mReservations.filter((r) => r.campaign_id === c.id).length;
            mExpected += ct * c.ticket_price;
          }

          memberBreakdowns.push({
            id: m.id,
            name: m.full_name,
            code: m.seller_code,
            sold: mTaken,
            confirmed_amount: mConfirmed,
            pending_amount: mExpected - mConfirmed,
          });
        }

        memberBreakdowns.sort((a, b) => b.sold - a.sold);

        result.push({
          id: group.id,
          name: group.name,
          color: group.color,
          admin_name: admin?.full_name || "—",
          member_count: members.length,
          campaigns_assigned: groupCampaignIds.length,
          total_sold: totalTaken,
          total_expected: expectedTotal,
          confirmed_amount: confirmedTotal,
          pending_amount: expectedTotal - confirmedTotal,
          members: memberBreakdowns,
        });
      }

      result.sort((a, b) => b.total_sold - a.total_sold);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Tab inválida" }, { status: 400 });
  } catch (err) {
    console.error("Reports error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
