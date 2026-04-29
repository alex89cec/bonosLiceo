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
  BonosDetailRow,
  EventsSummary,
  EventReportRow,
  EventReportTypeBreakdown,
  EventOrderRow,
  EventOrderItem,
  EventsSellerReport,
  EventsSellerEventBreakdown,
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
      .select("role, is_active, is_approver")
      .eq("id", user.id)
      .single();
    const allowed =
      profile?.is_active &&
      (profile.role === "admin" || profile.is_approver === true);
    if (!profile || !allowed) {
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

    // Filter campaigns by status
    // "all" shows active + sorted (NOT closed); closed only visible via "closed" filter
    const filteredCampaigns =
      statusFilter === "all"
        ? allCampaigns.filter((c) => c.status !== "closed")
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

    // ── TAB: bonos-detail ──
    // Per-reservation report: every active/confirmed/cancelled reservation
    // with its ticket number, seller, buyer, and current payment status.
    if (tab === "bonos-detail") {
      // Look up additional joined data (buyers, ticket numbers)
      const buyerIds = [...new Set(allReservations.map((r) => r.buyer_id))];
      const { data: buyersFull } = buyerIds.length
        ? await supabase
            .from("buyers")
            .select("id, email, full_name")
            .in("id", buyerIds)
        : { data: [] };

      const ticketIds = allReservations.map((r) => r.ticket_id).filter(Boolean);
      let ticketNumberMap2 = new Map<string, string>();
      if (ticketIds.length > 0) {
        const { data: ticketRows } = await supabase
          .from("tickets")
          .select("id, number")
          .in("id", ticketIds);
        for (const t of ticketRows || []) ticketNumberMap2.set(t.id, t.number);
      }
      const buyerById = new Map(
        (buyersFull || []).map((b) => [
          b.id,
          { email: b.email as string, full_name: (b.full_name as string) || null },
        ]),
      );

      // Enrich reservations with timestamps (needed for sorting/display)
      // Re-fetch with created_at since the base query doesn't have it
      const { data: reservationsWithDate } = await supabase
        .from("reservations")
        .select("id, created_at");
      const dateById = new Map(
        (reservationsWithDate || []).map((r) => [
          r.id as string,
          r.created_at as string,
        ]),
      );

      // Payment status by reservation
      const paymentByRes = new Map(
        allPayments.map((p) => [
          p.reservation_id,
          { status: p.status as string, amount: p.amount as number },
        ]),
      );

      const rows: BonosDetailRow[] = allReservations
        .filter((r) => filteredCampaignIds.has(r.campaign_id))
        .map((r) => {
          const seller = allProfiles.find((p) => p.id === r.seller_id);
          const buyer = buyerById.get(r.buyer_id);
          const campaign = allCampaigns.find((c) => c.id === r.campaign_id);
          const payment = paymentByRes.get(r.id);
          return {
            id: r.id,
            ticket_number: ticketNumberMap2.get(r.ticket_id) || "—",
            campaign_id: r.campaign_id,
            campaign_name: campaign?.name || "—",
            campaign_status: campaign?.status || "—",
            seller_id: r.seller_id || null,
            seller_name: seller?.full_name || null,
            seller_code: seller?.seller_code || null,
            buyer_id: r.buyer_id,
            buyer_email: buyer?.email || "—",
            buyer_name: buyer?.full_name || null,
            status: r.status as "active" | "confirmed" | "cancelled",
            payment_status:
              (payment?.status as "pending" | "partial" | "completed") ?? null,
            amount: payment?.amount || 0,
            created_at: dateById.get(r.id) || "",
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      return NextResponse.json(rows);
    }

    // ────────────────────────────────────────────────────────────
    // EVENT REPORTS
    // ────────────────────────────────────────────────────────────
    // For event reports we use a separate set of queries focused on the
    // events module (event_orders + event_tickets). Status filter for
    // events: active/past/cancelled, with "all" excluding past+cancelled
    // (mirroring the public/seller behavior — closed events stay hidden
    // unless you specifically ask).

    if (tab.startsWith("events-")) {
      const eventStatus =
        statusFilter === "all"
          ? null // means: active + past (NOT cancelled)
          : statusFilter; // specific status

      // Fetch events
      let eventsQuery = supabase
        .from("events")
        .select("id, name, slug, status, event_date, venue");
      if (eventStatus) {
        eventsQuery = eventsQuery.eq("status", eventStatus);
      } else {
        eventsQuery = eventsQuery.in("status", ["active", "past"]);
      }
      const { data: events } = await eventsQuery.order("event_date", {
        ascending: false,
      });
      const eventsList = events || [];
      const eventIdsForReport = new Set(eventsList.map((e) => e.id));

      // All orders + tickets in scope
      const [
        { data: eventOrders },
        { data: eventTickets },
        { data: eventTypes },
        { data: eventBuyers },
        { data: eventSellers },
      ] = await Promise.all([
        supabase
          .from("event_orders")
          .select(
            "id, event_id, buyer_id, seller_id, items, total_amount, payment_method, receipt_filename, status, rejection_reason, notes, created_at, reviewed_at",
          ),
        supabase.from("event_tickets").select(
          "id, event_id, ticket_type_id, parent_bundle_type_id, status, order_id",
        ),
        supabase
          .from("event_ticket_types")
          .select("id, event_id, name, color, quantity, bundle_items"),
        supabase.from("buyers").select("id, email, full_name"),
        supabase.from("profiles").select("id, full_name, email, seller_code"),
      ]);

      const orders = (eventOrders || []).filter((o) =>
        eventIdsForReport.has(o.event_id as string),
      );
      const tickets = (eventTickets || []).filter((t) =>
        eventIdsForReport.has(t.event_id as string),
      );
      const types = eventTypes || [];
      const buyersMapEv = new Map(
        (eventBuyers || []).map((b) => [
          b.id as string,
          {
            email: b.email as string,
            full_name: (b.full_name as string) || null,
          },
        ]),
      );
      const profilesMapEv = new Map(
        (eventSellers || []).map((p) => [
          p.id as string,
          {
            full_name: p.full_name as string,
            email: p.email as string,
            seller_code: (p.seller_code as string) || null,
          },
        ]),
      );

      // events-summary
      if (tab === "events-summary") {
        const summary: EventsSummary = {
          total_events: eventsList.length,
          active_events: eventsList.filter((e) => e.status === "active").length,
          total_orders: orders.length,
          approved_orders: orders.filter((o) => o.status === "approved").length,
          pending_orders: orders.filter(
            (o) =>
              o.status === "pending_review" || o.status === "awaiting_receipt",
          ).length,
          rejected_orders: orders.filter((o) => o.status === "rejected").length,
          complimentary_orders: orders.filter(
            (o) => o.status === "complimentary",
          ).length,
          total_tickets_issued: tickets.filter(
            (t) => t.status === "valid" || t.status === "used",
          ).length,
          total_amount_collected: orders
            .filter((o) => o.status === "approved")
            .reduce((s, o) => s + Number(o.total_amount || 0), 0),
          total_amount_pending: orders
            .filter(
              (o) =>
                o.status === "pending_review" ||
                o.status === "awaiting_receipt",
            )
            .reduce((s, o) => s + Number(o.total_amount || 0), 0),
        };
        return NextResponse.json(summary);
      }

      // events-list — per-event breakdown
      if (tab === "events-list") {
        const result: EventReportRow[] = [];
        for (const e of eventsList) {
          const eventOrders = orders.filter((o) => o.event_id === e.id);
          const eventTks = tickets.filter((t) => t.event_id === e.id);
          const eventTps = types.filter((t) => t.event_id === e.id);

          const typesBreakdown: EventReportTypeBreakdown[] = eventTps.map(
            (t) => {
              const isBundle =
                Array.isArray(t.bundle_items) && t.bundle_items.length > 0;

              let sold = 0;
              if (isBundle) {
                // Count tickets generated by this bundle, divided by tickets-per-bundle
                const ticketsFromBundle = eventTks.filter(
                  (tk) =>
                    tk.parent_bundle_type_id === t.id &&
                    (tk.status === "valid" || tk.status === "used"),
                ).length;
                const ticketsPerBundle = (
                  t.bundle_items as { quantity: number }[]
                ).reduce((s, c) => s + c.quantity, 0);
                sold = Math.ceil(
                  ticketsFromBundle / Math.max(ticketsPerBundle, 1),
                );
              } else {
                sold = eventTks.filter(
                  (tk) =>
                    tk.ticket_type_id === t.id &&
                    !tk.parent_bundle_type_id &&
                    (tk.status === "valid" || tk.status === "used"),
                ).length;
              }

              // Pending = quantities in pending orders for this type
              let pending = 0;
              for (const o of eventOrders) {
                if (
                  o.status !== "pending_review" &&
                  o.status !== "awaiting_receipt"
                )
                  continue;
                const items = (o.items as
                  | { ticket_type_id: string; quantity: number }[]
                  | null) || [];
                for (const it of items) {
                  if (it.ticket_type_id === t.id) pending += it.quantity;
                }
              }

              return {
                id: t.id as string,
                name: t.name as string,
                color: (t.color as string) || "gray",
                quantity: t.quantity === null ? null : (t.quantity as number),
                sold,
                pending,
                is_bundle: isBundle,
              };
            },
          );

          result.push({
            id: e.id as string,
            name: e.name as string,
            slug: e.slug as string,
            status: e.status as string,
            event_date: e.event_date as string,
            venue: (e.venue as string) || null,
            total_orders: eventOrders.length,
            approved_orders: eventOrders.filter((o) => o.status === "approved")
              .length,
            pending_orders: eventOrders.filter(
              (o) =>
                o.status === "pending_review" ||
                o.status === "awaiting_receipt",
            ).length,
            rejected_orders: eventOrders.filter((o) => o.status === "rejected")
              .length,
            tickets_issued: eventTks.filter(
              (t) => t.status === "valid" || t.status === "used",
            ).length,
            total_amount_collected: eventOrders
              .filter((o) => o.status === "approved")
              .reduce((s, o) => s + Number(o.total_amount || 0), 0),
            total_amount_pending: eventOrders
              .filter(
                (o) =>
                  o.status === "pending_review" ||
                  o.status === "awaiting_receipt",
              )
              .reduce((s, o) => s + Number(o.total_amount || 0), 0),
            types: typesBreakdown,
          });
        }
        return NextResponse.json(result);
      }

      // events-orders — flat list with all info for the table
      if (tab === "events-orders") {
        const eventNameById = new Map(
          eventsList.map((e) => [e.id as string, e.name as string]),
        );
        const rows: EventOrderRow[] = orders.map((o) => {
          const buyer = buyersMapEv.get(o.buyer_id as string);
          const seller = o.seller_id
            ? profilesMapEv.get(o.seller_id as string)
            : null;
          return {
            id: o.id as string,
            event_id: o.event_id as string,
            event_name: eventNameById.get(o.event_id as string) || "—",
            buyer_id: o.buyer_id as string,
            buyer_email: buyer?.email || "—",
            buyer_name: buyer?.full_name || null,
            seller_id: (o.seller_id as string) || null,
            seller_name: seller?.full_name || null,
            seller_code: seller?.seller_code || null,
            items: (o.items as EventOrderItem[]) || [],
            total_amount: Number(o.total_amount || 0),
            payment_method: o.payment_method as string,
            receipt_filename: (o.receipt_filename as string) || null,
            status: o.status as string,
            rejection_reason: (o.rejection_reason as string) || null,
            created_at: o.created_at as string,
            reviewed_at: (o.reviewed_at as string) || null,
          };
        });
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
        return NextResponse.json(rows);
      }

      // events-sellers — sellers ranked by event sales
      if (tab === "events-sellers") {
        const sellersMap = new Map<
          string,
          {
            id: string;
            name: string;
            email: string;
            code: string | null;
            total_orders: number;
            approved_orders: number;
            pending_orders: number;
            total_amount_collected: number;
            events: Map<
              string,
              {
                event_id: string;
                event_name: string;
                approved_orders: number;
                pending_orders: number;
                amount_collected: number;
              }
            >;
          }
        >();

        const eventNameById = new Map(
          eventsList.map((e) => [e.id as string, e.name as string]),
        );

        for (const o of orders) {
          if (!o.seller_id) continue;
          const sellerId = o.seller_id as string;
          const sellerProfile = profilesMapEv.get(sellerId);
          if (!sellerProfile) continue;

          if (!sellersMap.has(sellerId)) {
            sellersMap.set(sellerId, {
              id: sellerId,
              name: sellerProfile.full_name,
              email: sellerProfile.email,
              code: sellerProfile.seller_code,
              total_orders: 0,
              approved_orders: 0,
              pending_orders: 0,
              total_amount_collected: 0,
              events: new Map(),
            });
          }
          const s = sellersMap.get(sellerId)!;
          s.total_orders++;
          if (o.status === "approved") {
            s.approved_orders++;
            s.total_amount_collected += Number(o.total_amount || 0);
          }
          if (
            o.status === "pending_review" ||
            o.status === "awaiting_receipt"
          ) {
            s.pending_orders++;
          }

          const evId = o.event_id as string;
          if (!s.events.has(evId)) {
            s.events.set(evId, {
              event_id: evId,
              event_name: eventNameById.get(evId) || "—",
              approved_orders: 0,
              pending_orders: 0,
              amount_collected: 0,
            });
          }
          const ev = s.events.get(evId)!;
          if (o.status === "approved") {
            ev.approved_orders++;
            ev.amount_collected += Number(o.total_amount || 0);
          }
          if (
            o.status === "pending_review" ||
            o.status === "awaiting_receipt"
          ) {
            ev.pending_orders++;
          }
        }

        const result: EventsSellerReport[] = Array.from(
          sellersMap.values(),
        ).map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          code: s.code,
          total_orders: s.total_orders,
          approved_orders: s.approved_orders,
          pending_orders: s.pending_orders,
          total_amount_collected: s.total_amount_collected,
          events: Array.from(s.events.values()) as EventsSellerEventBreakdown[],
        }));

        result.sort(
          (a, b) => b.total_amount_collected - a.total_amount_collected,
        );
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ error: "Tab inválida" }, { status: 400 });
  } catch (err) {
    console.error("Reports error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
