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
    const [
      { data: campaigns },
      { data: tickets },
      { data: reservations },
      { data: payments },
      { data: installments },
      { data: profiles },
      { data: campaignSellers },
      { data: campaignGroups },
      { data: groups },
    ] = await Promise.all([
      supabase.from("campaigns").select("id, name, status, ticket_price, number_from, number_to"),
      supabase.from("tickets").select("id, campaign_id, status, seller_id"),
      supabase.from("reservations").select("id, campaign_id, seller_id, status"),
      supabase.from("payments").select("id, campaign_id, reservation_id, amount, status"),
      supabase.from("installments").select("id, payment_id, amount, status, due_date"),
      supabase.from("profiles").select("id, full_name, email, role, seller_code, group_id, is_active").in("role", ["seller", "admin"]),
      supabase.from("campaign_sellers").select("campaign_id, seller_id"),
      supabase.from("campaign_groups").select("campaign_id, group_id"),
      supabase.from("seller_groups").select("id, name, color, admin_id"),
    ]);

    const allCampaigns = campaigns || [];
    const allTickets = tickets || [];
    const allReservations = reservations || [];
    const allPayments = payments || [];
    const allInstallments = installments || [];
    const allProfiles = profiles || [];
    const allCampaignSellers = campaignSellers || [];
    const allCampaignGroups = campaignGroups || [];
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

    // Build payment→campaign map & payment→seller
    const paymentCampaignMap = new Map<string, string>();
    const paymentSellerMap = new Map<string, string>();
    for (const p of allPayments) {
      paymentCampaignMap.set(p.id, p.campaign_id);
      const sellerId = reservationSellerMap.get(p.reservation_id);
      if (sellerId) paymentSellerMap.set(p.id, sellerId);
    }

    // ── TAB: summary ──
    if (tab === "summary") {
      let totalExpected = 0;
      let totalConfirmed = 0;
      let totalPending = 0;
      let totalNumbers = 0;
      let totalSold = 0;
      let totalReserved = 0;

      const summaryCampaigns: SummaryCampaign[] = [];

      for (const c of filteredCampaigns) {
        const total = c.number_to - c.number_from + 1;
        const cTickets = allTickets.filter((t) => t.campaign_id === c.id);
        const sold = cTickets.filter((t) => t.status === "sold").length;
        const reserved = cTickets.filter((t) => t.status === "reserved").length;
        const expected = (sold + reserved) * c.ticket_price;

        const cPayments = allPayments.filter((p) => p.campaign_id === c.id);
        const confirmed = cPayments
          .filter((p) => p.status === "completed")
          .reduce((s, p) => s + p.amount, 0);

        // For partial payments, count paid installments
        const partialPaymentIds = new Set(
          cPayments.filter((p) => p.status === "partial").map((p) => p.id)
        );
        const paidInstallments = allInstallments
          .filter((i) => partialPaymentIds.has(i.payment_id) && i.status === "paid")
          .reduce((s, i) => s + i.amount, 0);

        const totalConfirmedForCampaign = confirmed + paidInstallments;
        const pending = expected - totalConfirmedForCampaign;

        totalExpected += expected;
        totalConfirmed += totalConfirmedForCampaign;
        totalPending += pending;
        totalNumbers += total;
        totalSold += sold;
        totalReserved += reserved;

        summaryCampaigns.push({
          id: c.id,
          name: c.name,
          status: c.status,
          total,
          sold,
          reserved,
          percent: total > 0 ? ((sold + reserved) / total) * 100 : 0,
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
        total_reserved: totalReserved,
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
        const cTickets = allTickets.filter((t) => t.campaign_id === c.id);
        const available = cTickets.filter((t) => t.status === "available").length;
        const reserved = cTickets.filter((t) => t.status === "reserved").length;
        const sold = cTickets.filter((t) => t.status === "sold").length;
        const expected = (sold + reserved) * c.ticket_price;

        const cPayments = allPayments.filter((p) => p.campaign_id === c.id);
        const confirmed = cPayments
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

        // Per-seller breakdown
        const sellerMap = new Map<string, CampaignSellerBreakdown>();
        for (const t of cTickets) {
          if (!t.seller_id || t.status === "available") continue;
          if (!sellerMap.has(t.seller_id)) {
            const p = allProfiles.find((pr) => pr.id === t.seller_id);
            sellerMap.set(t.seller_id, {
              id: t.seller_id,
              name: p?.full_name || "—",
              code: p?.seller_code || null,
              reserved: 0,
              sold: 0,
              confirmed_amount: 0,
              pending_amount: 0,
            });
          }
          const entry = sellerMap.get(t.seller_id)!;
          if (t.status === "reserved") entry.reserved++;
          if (t.status === "sold") entry.sold++;
        }

        // Add payment amounts per seller
        for (const p of cPayments) {
          const sellerId = paymentSellerMap.get(p.id);
          if (!sellerId || !sellerMap.has(sellerId)) continue;
          const entry = sellerMap.get(sellerId)!;
          if (p.status === "completed") {
            entry.confirmed_amount += p.amount;
          } else {
            // For partial, add paid installments
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
          reserved,
          sold,
          percent_sold: total > 0 ? ((sold + reserved) / total) * 100 : 0,
          expected_amount: expected,
          confirmed_amount: confirmed + paidInstallments,
          partial_amount: paidInstallments,
          pending_amount: expected - confirmed - paidInstallments,
          overdue_installments: overdueList.length,
          overdue_amount: overdueList.reduce((s, i) => s + i.amount, 0),
          sellers: Array.from(sellerMap.values()).sort((a, b) => b.sold - a.sold),
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

        // Tickets by this seller in filtered campaigns
        const sellerTickets = allTickets.filter(
          (t) => t.seller_id === seller.id && filteredCampaignIds.has(t.campaign_id)
        );
        const totalReserved = sellerTickets.filter((t) => t.status === "reserved").length;
        const totalSold = sellerTickets.filter((t) => t.status === "sold").length;

        // Payments for this seller's reservations
        const sellerReservationIds = new Set(
          allReservations
            .filter((r) => r.seller_id === seller.id && filteredCampaignIds.has(r.campaign_id))
            .map((r) => r.id)
        );
        const sellerPayments = allPayments.filter((p) => {
          const rSellerId = reservationSellerMap.get(p.reservation_id);
          return rSellerId === seller.id && filteredCampaignIds.has(p.campaign_id);
        });

        let confirmedTotal = 0;
        let expectedTotal = 0;

        // Per-campaign breakdown
        const campaignBreakdowns: SellerCampaignBreakdown[] = [];

        for (const cid of new Set([...assigned, ...sellerTickets.map((t) => t.campaign_id)])) {
          const campaign = allCampaigns.find((c) => c.id === cid);
          if (!campaign) continue;

          const cTickets = sellerTickets.filter((t) => t.campaign_id === cid);
          const cReserved = cTickets.filter((t) => t.status === "reserved").length;
          const cSold = cTickets.filter((t) => t.status === "sold").length;
          const cExpected = (cReserved + cSold) * campaign.ticket_price;

          const cPayments = sellerPayments.filter((p) => p.campaign_id === cid);
          let cConfirmed = cPayments
            .filter((p) => p.status === "completed")
            .reduce((s, p) => s + p.amount, 0);

          // Partial paid installments
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
        if (assigned.length === 0 && totalReserved === 0 && totalSold === 0) continue;

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
          campaigns: campaignBreakdowns.sort((a, b) => b.sold - a.sold),
        });
      }

      result.sort((a, b) => b.total_sold - a.total_sold);
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

        // All tickets by group members in filtered campaigns
        const groupTickets = allTickets.filter(
          (t) => t.seller_id && memberIds.has(t.seller_id) && filteredCampaignIds.has(t.campaign_id)
        );
        const totalSold = groupTickets.filter((t) => t.status === "sold").length;
        const totalReserved = groupTickets.filter((t) => t.status === "reserved").length;

        // Payments by group members
        const groupPayments = allPayments.filter((p) => {
          const sellerId = paymentSellerMap.get(p.id);
          return sellerId && memberIds.has(sellerId) && filteredCampaignIds.has(p.campaign_id);
        });

        let confirmedTotal = 0;
        let expectedTotal = 0;

        for (const c of filteredCampaigns) {
          const cTickets = groupTickets.filter((t) => t.campaign_id === c.id);
          const cSold = cTickets.filter((t) => t.status === "sold").length;
          const cRes = cTickets.filter((t) => t.status === "reserved").length;
          expectedTotal += (cSold + cRes) * c.ticket_price;
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
          const mTickets = groupTickets.filter((t) => t.seller_id === m.id);
          const mSold = mTickets.filter((t) => t.status === "sold").length;
          const mReserved = mTickets.filter((t) => t.status === "reserved").length;

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
            const ct = mTickets.filter((t) => t.campaign_id === c.id);
            mExpected += (ct.filter((t) => t.status === "sold").length + ct.filter((t) => t.status === "reserved").length) * c.ticket_price;
          }

          memberBreakdowns.push({
            id: m.id,
            name: m.full_name,
            code: m.seller_code,
            sold: mSold + mReserved,
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
          total_sold: totalSold + totalReserved,
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
