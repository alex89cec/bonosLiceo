import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Supabase pauses free-tier projects after ~7 days without activity.
// A daily Vercel Cron (see vercel.json) hits this route and runs a trivial
// query so the database never looks idle.
//
// When CRON_SECRET is set in Vercel, the cron sends it as a Bearer token and
// we reject anything else. Without it the route stays open on purpose: it
// only reads one id, and a missing env var must not silently stop the pings.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("events").select("id").limit(1);
  if (error) {
    console.error("Keepalive query failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
