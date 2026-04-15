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

interface BatchParams {
  campaignSlug: string;
  sellerCode: string;
  buyerEmail: string;
  ticketNumbers: string[];
  paymentMode?: PaymentMode;
  buyerName?: string;
  buyerPhone?: string;
}

interface BatchError {
  ticket_number: string;
  error: string;
}

/** Fire-and-forget: send buyer confirmation email */
async function sendBuyerEmail(reservationIds: string[]) {
  try {
    await fetch("/api/emails/buyer-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservation_ids: reservationIds }),
    });
  } catch {
    // Non-blocking — sale already completed
    console.warn("Failed to send buyer confirmation email");
  }
}

export function useReservation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] =
    useState<ReserveTicketResponse | null>(null);
  const [batchResults, setBatchResults] = useState<ReserveTicketResponse[]>([]);
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([]);

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

      // Fire-and-forget: send buyer confirmation email
      const result = data as ReserveTicketResponse;
      sendBuyerEmail([result.reservation_id]);

      return result;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return null;
    }
  }

  async function reserveBatch(params: BatchParams) {
    setLoading(true);
    setError(null);
    setBatchResults([]);
    setBatchErrors([]);

    try {
      const res = await fetch("/api/reservations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_slug: params.campaignSlug,
          seller_code: params.sellerCode,
          buyer_email: params.buyerEmail,
          ticket_numbers: params.ticketNumbers,
          payment_mode: params.paymentMode,
          buyer_name: params.buyerName,
          buyer_phone: params.buyerPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok && !data.results) {
        setError(data.error || "Batch reservation failed");
        setLoading(false);
        return { results: [] as ReserveTicketResponse[], errors: [] as BatchError[] };
      }

      const results = (data.results || []) as ReserveTicketResponse[];
      const errors = (data.errors || []) as BatchError[];

      setBatchResults(results);
      setBatchErrors(errors);
      setLoading(false);

      // Fire-and-forget: send buyer confirmation email for all successful reservations
      if (results.length > 0) {
        sendBuyerEmail(results.map((r) => r.reservation_id));
      }

      return { results, errors };
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return { results: [] as ReserveTicketResponse[], errors: [] as BatchError[] };
    }
  }

  return {
    reserve,
    reserveBatch,
    loading,
    error,
    reservation,
    batchResults,
    batchErrors,
  };
}
