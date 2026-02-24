import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const lookupSchema = z.object({
  buyer_email: z
    .string()
    .email("Email inválido")
    .transform((v) => v.toLowerCase().trim()),
  reservation_id: z.string().uuid("ID de reserva inválido").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const ipLimit = rateLimit(`lookup:ip:${ip}`);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta más tarde." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleClient();

    if (parsed.data.reservation_id) {
      // Single lookup (backward compatible)
      const { data, error } = await supabase.rpc("lookup_reservation", {
        p_reservation_id: parsed.data.reservation_id,
        p_buyer_email: parsed.data.buyer_email,
      });

      if (error) {
        return NextResponse.json(
          { error: "No se encontro la reserva" },
          { status: 404 },
        );
      }

      return NextResponse.json(data);
    } else {
      // Email-only lookup — additional per-email rate limit
      const emailLimit = rateLimit(
        `lookup:email:${parsed.data.buyer_email}`,
      );
      if (!emailLimit.allowed) {
        return NextResponse.json(
          { error: "Demasiados intentos para este email." },
          { status: 429 },
        );
      }

      const { data, error } = await supabase.rpc(
        "lookup_reservations_by_email",
        {
          p_buyer_email: parsed.data.buyer_email,
        },
      );

      if (error) {
        return NextResponse.json(
          { error: "Error al buscar reservas" },
          { status: 500 },
        );
      }

      return NextResponse.json(data);
    }
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
