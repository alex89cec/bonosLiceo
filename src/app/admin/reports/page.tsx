"use client";

import { useEffect, useState, useCallback } from "react";
import SummaryTab from "@/components/reports/SummaryTab";
import CampaignReportTab from "@/components/reports/CampaignReportTab";
import SellerReportTab from "@/components/reports/SellerReportTab";
import GroupReportTab from "@/components/reports/GroupReportTab";
import type { SummaryReport, CampaignReport, SellerReport, GroupReport } from "@/types/reports";

const TABS = [
  { key: "summary", label: "Resumen" },
  { key: "campaigns", label: "Campañas" },
  { key: "sellers", label: "Vendedores" },
  { key: "groups", label: "Grupos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Activas" },
  { key: "sorted", label: "Sorteadas" },
  { key: "closed", label: "Cerradas" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data per tab
  const [summaryData, setSummaryData] = useState<SummaryReport | null>(null);
  const [campaignData, setCampaignData] = useState<CampaignReport[] | null>(null);
  const [sellerData, setSellerData] = useState<SellerReport[] | null>(null);
  const [groupData, setGroupData] = useState<GroupReport[] | null>(null);

  const fetchData = useCallback(async (tab: TabKey, status: StatusKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports?tab=${tab}&status=${status}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al cargar reportes");
      }
      const data = await res.json();
      switch (tab) {
        case "summary":
          setSummaryData(data);
          break;
        case "campaigns":
          setCampaignData(data);
          break;
        case "sellers":
          setSellerData(data);
          break;
        case "groups":
          setGroupData(data);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(activeTab, statusFilter);
  }, [activeTab, statusFilter, fetchData]);

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    // Clear the previous tab's data to force a fresh load
    switch (tab) {
      case "summary": setSummaryData(null); break;
      case "campaigns": setCampaignData(null); break;
      case "sellers": setSellerData(null); break;
      case "groups": setGroupData(null); break;
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Reportes</h2>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-navy-700 text-white"
                : "border border-navy-200 text-navy-600 hover:bg-navy-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Campaign status filter */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-gold-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {activeTab === "summary" && summaryData && <SummaryTab data={summaryData} />}
          {activeTab === "campaigns" && campaignData && <CampaignReportTab data={campaignData} />}
          {activeTab === "sellers" && sellerData && <SellerReportTab data={sellerData} />}
          {activeTab === "groups" && groupData && <GroupReportTab data={groupData} />}
        </>
      )}
    </div>
  );
}
