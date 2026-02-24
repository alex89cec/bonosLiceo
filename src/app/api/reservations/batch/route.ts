import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { emailSchema, ticketNumberSchema } from "@/lib/validations";

const batchSchema = z.object({
  campaign_slug: z.string().min(1),
  seller_code: z.string().min(1),
  buyer_email: emailSchema,
  ticket_numbers: z.array(ticketNumberSchema).min(1).max(50),
  payment_mode: z.enum(["full_payment", "installments"]).optional(),
  buyer_name: z.string().optional(),
  buyer_phone: z.string().optional(),
});

interface BatchResult {
  success: boolean;
  reservation_id: string;
  ticket_number: string;
  campaign_name: string;
  ticket_price: number;
  payment_mode: string;
  installments_count: number;
  buyer_email: string;
  seller_name: string;
}

interface BatchError {
  ticket_number: string;
  error: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP (single hit for the whole batch)
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
    const parsed = batchSchema.safeParse(body);
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

    const supabase = createServiceRoleClient();
    const results: BatchResult[] = [];
    const errors: BatchError[] = [];

    // Process each ticket sequentially (RPC uses FOR UPDATE row locks)
    for (const ticketNumber of input.ticket_numbers) {
      const { data, error } = await supabase.rpc("reserve_ticket", {
        p_campaign_slug: input.campaign_slug,
        p_seller_code: input.seller_code,
        p_ticket_number: ticketNumber,
        p_buyer_email: input.buyer_email,
        p_buyer_name: input.buyer_name ?? null,
        p_buyer_phone: input.buyer_phone ?? null,
        p_payment_mode: input.payment_mode ?? null,
      });

      if (error) {
        errors.push({
          ticket_number: ticketNumber,
          error: error.message || "Reservation failed",
        });
      } else {
        results.push(data as BatchResult);
      }
    }

    // Return 201 if any succeeded, 400 if all failed
    const status = results.length > 0 ? 201 : 400;

    return NextResponse.json({ results, errors }, { status });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
