import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { z } from "zod";
import { verifyQrToken } from "@/lib/qr-token";

export const maxDuration = 10;

const inputSchema = z.object({
  token: z.string().min(1).max(500),
  event_id: z.string().uuid(),
  mode: z.enum(["real", "test"]).default("real"),
});

type ScanResult =
  | "valid"
  | "already_used"
  | "invalid"
  | "wrong_event"
  | "cancelled";

/**
 * POST /api/scanner/scan
 *
 * Validates a scanned QR token and (in real mode) marks the ticket
 * as used. Always logs the attempt to event_scan_logs for audit.
 *
 * Auth: admin OR seller with can_scan=true on the event.
 */
export async function POST(request: NextRequest) {
  try {
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
      .select("role, is_active")
      .eq("id", user.id)
      .single();
    if (!profile || !profile.is_active) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }
    const { token, event_id, mode } = parsed.data;

    // Verify user can scan THIS event
    const isAdmin = profile.role === "admin";
    let canScan = isAdmin;
    if (!isAdmin) {
      const { data: assignment } = await service
        .from("event_sellers")
        .select("can_scan")
        .eq("event_id", event_id)
        .eq("seller_id", user.id)
        .maybeSingle();
      canScan = assignment?.can_scan === true;
    }
    if (!canScan) {
      return NextResponse.json(
        { error: "No tenés permiso para escanear este evento" },
        { status: 403 },
      );
    }

    // Verify HMAC + parse ticket id
    const ticketId = verifyQrToken(token);
    if (!ticketId) {
      // Log invalid scan
      await service.from("event_scan_logs").insert({
        event_ticket_id: null,
        event_id,
        scanned_by: user.id,
        result: "invalid",
        metadata: {
          test: mode === "test",
          reason: "invalid_token",
          token_preview: token.slice(0, 20),
        },
      });
      return NextResponse.json({ result: "invalid" satisfies ScanResult });
    }

    // Fetch the ticket with everything we need to display
    const { data: ticket } = await service
      .from("event_tickets")
      .select(
        `
        id, event_id, status, entered_at, entered_by,
        ticket_type:ticket_type_id (name, color),
        parent_bundle:parent_bundle_type_id (name),
        buyers:buyer_id (full_name, email),
        events:event_id (name)
      `,
      )
      .eq("id", ticketId)
      .single();

    if (!ticket) {
      await service.from("event_scan_logs").insert({
        event_ticket_id: null,
        event_id,
        scanned_by: user.id,
        result: "invalid",
        metadata: { test: mode === "test", reason: "ticket_not_found" },
      });
      return NextResponse.json({ result: "invalid" satisfies ScanResult });
    }

    const ticketType = ticket.ticket_type as unknown as
      | { name: string; color: string | null }
      | null;
    const parentBundle = ticket.parent_bundle as unknown as
      | { name: string }
      | null;
    const buyer = ticket.buyers as unknown as
      | { full_name: string | null; email: string }
      | null;
    const ticketEvent = ticket.events as unknown as
      | { name: string }
      | null;

    // Wrong event?
    if (ticket.event_id !== event_id) {
      await service.from("event_scan_logs").insert({
        event_ticket_id: ticket.id as string,
        event_id,
        scanned_by: user.id,
        result: "wrong_event",
        metadata: {
          test: mode === "test",
          ticket_event_id: ticket.event_id,
          ticket_event_name: ticketEvent?.name || null,
        },
      });
      return NextResponse.json({
        result: "wrong_event" satisfies ScanResult,
        ticket: {
          buyer_name: buyer?.full_name || null,
          buyer_email: buyer?.email || null,
          type_name: ticketType?.name || "Entrada",
          type_color: ticketType?.color || null,
          parent_bundle_name: parentBundle?.name || null,
          actual_event_name: ticketEvent?.name || null,
        },
      });
    }

    // Cancelled or refunded?
    if (ticket.status === "cancelled" || ticket.status === "refunded") {
      await service.from("event_scan_logs").insert({
        event_ticket_id: ticket.id as string,
        event_id,
        scanned_by: user.id,
        result: "cancelled",
        metadata: { test: mode === "test", actual_status: ticket.status },
      });
      return NextResponse.json({
        result: "cancelled" satisfies ScanResult,
        ticket: {
          buyer_name: buyer?.full_name || null,
          buyer_email: buyer?.email || null,
          type_name: ticketType?.name || "Entrada",
          type_color: ticketType?.color || null,
          parent_bundle_name: parentBundle?.name || null,
          status: ticket.status as string,
        },
      });
    }

    // Already used?
    if (ticket.status === "used") {
      // Look up who scanned it before (best-effort)
      let enteredByName: string | null = null;
      if (ticket.entered_by) {
        const { data: enteredProfile } = await service
          .from("profiles")
          .select("full_name")
          .eq("id", ticket.entered_by)
          .single();
        enteredByName = enteredProfile?.full_name || null;
      }
      await service.from("event_scan_logs").insert({
        event_ticket_id: ticket.id as string,
        event_id,
        scanned_by: user.id,
        result: "already_used",
        metadata: {
          test: mode === "test",
          original_entered_at: ticket.entered_at,
        },
      });
      return NextResponse.json({
        result: "already_used" satisfies ScanResult,
        ticket: {
          buyer_name: buyer?.full_name || null,
          buyer_email: buyer?.email || null,
          type_name: ticketType?.name || "Entrada",
          type_color: ticketType?.color || null,
          parent_bundle_name: parentBundle?.name || null,
          entered_at: ticket.entered_at as string | null,
          entered_by_name: enteredByName,
        },
      });
    }

    // Valid! Mark as used (real mode only)
    if (mode === "real") {
      await service
        .from("event_tickets")
        .update({
          status: "used",
          entered_at: new Date().toISOString(),
          entered_by: user.id,
        })
        .eq("id", ticket.id);
    }

    await service.from("event_scan_logs").insert({
      event_ticket_id: ticket.id as string,
      event_id,
      scanned_by: user.id,
      result: "valid",
      metadata: { test: mode === "test" },
    });

    return NextResponse.json({
      result: "valid" satisfies ScanResult,
      ticket: {
        buyer_name: buyer?.full_name || null,
        buyer_email: buyer?.email || null,
        type_name: ticketType?.name || "Entrada",
        type_color: ticketType?.color || null,
        parent_bundle_name: parentBundle?.name || null,
      },
      mode,
    });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
