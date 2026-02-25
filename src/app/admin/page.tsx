import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Campaign } from "@/types/database";

export default async function AdminCampaignsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch taken counts per campaign
  const campaignList = (campaigns as Campaign[] | null) ?? [];
  const takenMap: Record<string, number> = {};

  if (campaignList.length > 0) {
    const { data: takenData } = await supabase.rpc("get_campaign_taken_counts");

    if (takenData) {
      for (const row of takenData as Array<{
        campaign_id: string;
        taken_count: number;
      }>) {
        takenMap[row.campaign_id] = row.taken_count;
      }
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Campañas</h2>
        <a href="/admin/campaigns/new" className="btn-primary">
          + Nueva campaña
        </a>
      </div>

      <div className="space-y-3">
        {campaignList.map((campaign) => {
          const taken = takenMap[campaign.id] ?? 0;
          const isEditable = taken === 0;

          return (
            <Link
              key={campaign.id}
              href={`/admin/campaigns/${campaign.id}/edit`}
              className="card block transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{campaign.name}</h3>
                    {!isEditable && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 flex-shrink-0 text-amber-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">/{campaign.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      campaign.status === "active"
                        ? "bg-green-100 text-green-700"
                        : campaign.status === "sorted"
                          ? "bg-purple-100 text-purple-700"
                          : campaign.status === "draft"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {campaign.status === "draft"
                      ? "Borrador"
                      : campaign.status === "active"
                        ? "Activa"
                        : campaign.status === "sorted"
                          ? "Sorteada"
                          : "Cerrada"}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                <span>${campaign.ticket_price}</span>
                <span className="font-mono">
                  {String(campaign.number_from).padStart(5, "0")}–
                  {String(campaign.number_to).padStart(5, "0")}
                </span>
                {campaign.installments_enabled && (
                  <span>{campaign.installments_count} cuotas</span>
                )}
                {taken > 0 && (
                  <span className="text-amber-600">
                    {taken} vendido{taken !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        {!campaigns?.length && (
          <p className="py-12 text-center text-gray-500">
            No hay campañas. Crea la primera.
          </p>
        )}
      </div>
    </div>
  );
}
