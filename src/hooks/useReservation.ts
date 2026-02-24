import { useState } from "react";
import type { ReserveTicketResponse, PaymentMode } from "@/types/database";

interface ReserveParams {
  campaignSlug: string;
  sellerCode: string;
  buyerEmail: string;
  ticketNumber: string;
  paymentMode?: PaymentMode;
  buyerName?: string;
  buyerPhone?: string;
}

export function useReservation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] =
    useState<ReserveTicketResponse | null>(null);

  async function reserve(params: ReserveParams) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_slug: params.campaignSlug,
          seller_code: params.sellerCode,
          buyer_email: params.buyerEmail,
          ticket_number: params.ticketNumber,
          payment_mode: params.paymentMode,
          buyer_name: params.buyerName,
          buyer_phone: params.buyerPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Reservation failed");
        setLoading(false);
        return null;
      }

      setReservation(data);
      setLoading(false);
      return data as ReserveTicketResponse;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return null;
    }
  }

  return { reserve, loading, error, reservation };
}
