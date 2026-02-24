import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { reserveTicketSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const ipLimit = rateLimit(`reserve:ip:${ip}`);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((ipLimit.resetAt - Date.now()) / 1000),
            ),
          },
        },
      );
    }

    const body = await request.json();

    // Validate input
    const parsed = reserveTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const input = parsed.data;

    // Rate limit by email too
    const emailLimit = rateLimit(`reserve:email:${input.buyer_email}`);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many reservation attempts for this email." },
        { status: 429 },
      );
    }

    // Use service role client to call RPC (bypasses RLS since RPC is SECURITY DEFINER)
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("reserve_ticket", {
      p_campaign_slug: input.campaign_slug,
      p_seller_code: input.seller_code,
      p_ticket_number: input.ticket_number,
      p_buyer_email: input.buyer_email,
      p_buyer_name: input.buyer_name ?? null,
      p_buyer_phone: input.buyer_phone ?? null,
      p_payment_mode: input.payment_mode ?? null,
    });

    if (error) {
      // Map Postgres exceptions to user-friendly messages
      const message = error.message || "Reservation failed";
      const status = message.includes("not available") ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
