import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AvailableTicketsResponse, TicketInfo } from "@/types/database";

export function useAvailableTickets(campaignSlug: string) {
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "get_available_tickets",
      {
        p_campaign_slug: campaignSlug,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const result = data as unknown as AvailableTicketsResponse;
    setTickets(result.tickets);
    setAvailableCount(result.available);
    setLoading(false);
  }, [campaignSlug]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { tickets, availableCount, loading, error, refetch: fetch };
}
