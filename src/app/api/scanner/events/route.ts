import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * GET /api/scanner/events
 *
 * Lists events the current user can scan.
 * - Admins: all active or past events
 * - Sellers: only events where event_sellers.can_scan = true
 *
 * The scanner UI uses this to populate the event picker.
 */
export async function GET() {
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

    const isAdmin = profile.role === "admin";

    let events: { id: string; name: string; slug: string; event_date: string; venue: string | null; status: string }[] = [];

    if (isAdmin) {
      // All scannable events (active or past — past so admins can scan late-comers)
      const { data } = await service
        .from("events")
        .select("id, name, slug, event_date, venue, status")
        .in("status", ["active", "past"])
        .order("event_date", { ascending: false });
      events = data || [];
    } else {
      // Sellers — only events where they're assigned with can_scan=true
      const { data: assignments } = await service
        .from("event_sellers")
        .select(
          "events:event_id (id, name, slug, event_date, venue, status)",
        )
        .eq("seller_id", user.id)
        .eq("can_scan", true);

      events = (assignments || [])
        .map(
          (a) =>
            a.events as unknown as {
              id: string;
              name: string;
              slug: string;
              event_date: string;
              venue: string | null;
              status: string;
            } | null,
        )
        .filter((e): e is NonNullable<typeof e> =>
          Boolean(e && (e.status === "active" || e.status === "past")),
        )
        .sort((a, b) => b.event_date.localeCompare(a.event_date));
    }

    return NextResponse.json({ events, is_admin: isAdmin });
  } catch (err) {
    console.error("Scanner events error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
