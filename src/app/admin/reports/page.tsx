"use client";

import { useEffect, useState, useCallback } from "react";
import SummaryTab from "@/components/reports/SummaryTab";
import CampaignReportTab from "@/components/reports/CampaignReportTab";
import SellerReportTab from "@/components/reports/SellerReportTab";
import GroupReportTab from "@/components/reports/GroupReportTab";
import BonosDetailTab from "@/components/reports/BonosDetailTab";
import EventsSummaryTab from "@/components/reports/EventsSummaryTab";
import EventsListTab from "@/components/reports/EventsListTab";
import EventsOrdersTab from "@/components/reports/EventsOrdersTab";
import EventsSellersTab from "@/components/reports/EventsSellersTab";
import EventsDetailTab from "@/components/reports/EventsDetailTab";
import type { SellerOption } from "@/components/reports/SellerPickerCell";
import type {
  SummaryReport,
  CampaignReport,
  SellerReport,
  GroupReport,
  BonosDetailRow,
  EventsSummary,
  EventReportRow,
  EventOrderRow,
  EventsSellerReport,
  EventTicketDetailRow,
} from "@/types/reports";

// ────────────────────────────────────────────────────────────
// Tab definitions
// ────────────────────────────────────────────────────────────
type Module = "rifas" | "eventos";

const RIFAS_TABS = [
  { key: "summary", label: "Resumen" },
  { key: "campaigns", label: "Campañas" },
  { key: "sellers", label: "Vendedores" },
  { key: "groups", label: "Grupos" },
  { key: "bonos-detail", label: "Detalle" },
] as const;

const EVENTOS_TABS = [
  { key: "events-summary", label: "Resumen" },
  { key: "events-list", label: "Eventos" },
  { key: "events-orders", label: "Órdenes" },
  { key: "events-sellers", label: "Vendedores" },
  { key: "events-detail", label: "Detalle" },
] as const;

type TabKey =
  | (typeof RIFAS_TABS)[number]["key"]
  | (typeof EVENTOS_TABS)[number]["key"];

// Status filters per module
const RIFAS_STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Activas" },
  { key: "sorted", label: "Sorteadas" },
  { key: "closed", label: "Cerradas" },
] as const;

const EVENTOS_STATUS_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "past", label: "Pasados" },
  { key: "cancelled", label: "Cancelados" },
] as const;

type RifasStatus = (typeof RIFAS_STATUS_FILTERS)[number]["key"];
type EventosStatus = (typeof EVENTOS_STATUS_FILTERS)[number]["key"];

export default function ReportsPage() {
  const [module, setModule] = useState<Module>("rifas");
  const [activeTab, setActiveTab] = useState<TabKey>("summary");

  const [rifasStatus, setRifasStatus] = useState<RifasStatus>("active");
  const [eventosStatus, setEventosStatus] = useState<EventosStatus>("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Data per tab
  const [summaryData, setSummaryData] = useState<SummaryReport | null>(null);
  const [campaignData, setCampaignData] = useState<CampaignReport[] | null>(
    null,
  );
  const [sellerData, setSellerData] = useState<SellerReport[] | null>(null);
  const [groupData, setGroupData] = useState<GroupReport[] | null>(null);
  const [bonosDetailData, setBonosDetailData] = useState<
    BonosDetailRow[] | null
  >(null);

  const [eventsSummary, setEventsSummary] = useState<EventsSummary | null>(
    null,
  );
  const [eventsList, setEventsList] = useState<EventReportRow[] | null>(null);
  const [eventsOrders, setEventsOrders] = useState<EventOrderRow[] | null>(
    null,
  );
  const [eventsSellers, setEventsSellers] = useState<
    EventsSellerReport[] | null
  >(null);
  const [eventsDetail, setEventsDetail] = useState<
    EventTicketDetailRow[] | null
  >(null);

  // Sellers list for the "asignar vendedor" picker (admins only)
  const [sellers, setSellers] = useState<SellerOption[]>([]);

  // Detect admin role for inline-edit permission (single check on mount)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile");
        const json = await res.json();
        if (res.ok && json.profile?.role === "admin") {
          setIsAdmin(true);
          // If admin, also load the seller options for the picker
          const r2 = await fetch("/api/admin/seller-options");
          if (r2.ok) {
            const j2 = await r2.json();
            setSellers(j2.sellers || []);
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const fetchData = useCallback(
    async (tab: TabKey, status: string) => {
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
          case "bonos-detail":
            setBonosDetailData(data);
            break;
          case "events-summary":
            setEventsSummary(data);
            break;
          case "events-list":
            setEventsList(data);
            break;
          case "events-orders":
            setEventsOrders(data);
            break;
          case "events-sellers":
            setEventsSellers(data);
            break;
          case "events-detail":
            setEventsDetail(data);
            break;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de conexión");
      }
      setLoading(false);
    },
    [],
  );

  // Re-fetch on tab/status change
  useEffect(() => {
    const status = module === "rifas" ? rifasStatus : eventosStatus;
    fetchData(activeTab, status);
  }, [activeTab, rifasStatus, eventosStatus, module, fetchData]);

  function switchModule(m: Module) {
    setModule(m);
    // Set default tab for the module
    setActiveTab(m === "rifas" ? "summary" : "events-summary");
  }

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    // Clear cached data so the loading skeleton shows
    switch (tab) {
      case "summary":
        setSummaryData(null);
        break;
      case "campaigns":
        setCampaignData(null);
        break;
      case "sellers":
        setSellerData(null);
        break;
      case "groups":
        setGroupData(null);
        break;
      case "bonos-detail":
        setBonosDetailData(null);
        break;
      case "events-summary":
        setEventsSummary(null);
        break;
      case "events-list":
        setEventsList(null);
        break;
      case "events-orders":
        setEventsOrders(null);
        break;
      case "events-sellers":
        setEventsSellers(null);
        break;
      case "events-detail":
        setEventsDetail(null);
        break;
    }
  }

  const subTabs = module === "rifas" ? RIFAS_TABS : EVENTOS_TABS;
  const statusFilters =
    module === "rifas" ? RIFAS_STATUS_FILTERS : EVENTOS_STATUS_FILTERS;
  const currentStatus = module === "rifas" ? rifasStatus : eventosStatus;
  const setCurrentStatus = (s: string) => {
    if (module === "rifas") setRifasStatus(s as RifasStatus);
    else setEventosStatus(s as EventosStatus);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Reportes</h2>

      {/* Master tab — Rifas / Eventos */}
      <div className="inline-flex rounded-2xl border border-navy-200 bg-white p-1 shadow-sm">
        {(["rifas", "eventos"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchModule(m)}
            className={`rounded-xl px-5 py-1.5 text-sm font-semibold transition-colors ${
              module === m
                ? "bg-navy-700 text-white"
                : "text-navy-600 hover:bg-navy-50"
            }`}
          >
            {m === "rifas" ? "🎫 Rifas" : "🎟️ Eventos"}
          </button>
        ))}
      </div>

      {/* Sub-tabs (underline tab bar) + status select.
          On desktop: tabs left, filter right of the same row.
          On mobile: tabs scroll horizontally, filter stacks below. */}
      <div className="border-b border-navy-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {/* Tab bar */}
          <div className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {subTabs.map(({ key, label }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => switchTab(key as TabKey)}
                  className={`whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors ${
                    active
                      ? "border-gold-500 text-gold-600"
                      : "border-transparent text-navy-400 hover:border-navy-200 hover:text-navy-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Status filter — native select for compact + great mobile UX */}
          <div className="flex items-center gap-2 pb-2">
            <label
              htmlFor="status-filter"
              className="text-xs font-medium text-navy-400"
            >
              Estado
            </label>
            <div className="relative">
              <select
                id="status-filter"
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
                className="cursor-pointer appearance-none rounded-lg border border-navy-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-navy-700 transition-colors hover:border-navy-300 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200"
              >
                {statusFilters.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-200 border-t-gold-500" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {activeTab === "summary" && summaryData && (
            <SummaryTab data={summaryData} />
          )}
          {activeTab === "campaigns" && campaignData && (
            <CampaignReportTab data={campaignData} />
          )}
          {activeTab === "sellers" && sellerData && (
            <SellerReportTab data={sellerData} />
          )}
          {activeTab === "groups" && groupData && (
            <GroupReportTab data={groupData} />
          )}
          {activeTab === "bonos-detail" && bonosDetailData && (
            <BonosDetailTab
              data={bonosDetailData}
              isAdmin={isAdmin}
              sellers={sellers}
            />
          )}

          {activeTab === "events-summary" && eventsSummary && (
            <EventsSummaryTab data={eventsSummary} />
          )}
          {activeTab === "events-list" && eventsList && (
            <EventsListTab data={eventsList} />
          )}
          {activeTab === "events-orders" && eventsOrders && (
            <EventsOrdersTab
              data={eventsOrders}
              isAdmin={isAdmin}
              sellers={sellers}
            />
          )}
          {activeTab === "events-sellers" && eventsSellers && (
            <EventsSellersTab data={eventsSellers} />
          )}
          {activeTab === "events-detail" && eventsDetail && (
            <EventsDetailTab
              data={eventsDetail}
              isAdmin={isAdmin}
              sellers={sellers}
            />
          )}
        </>
      )}
    </div>
  );
}
