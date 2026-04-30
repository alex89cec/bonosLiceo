import type { EventsSummary } from "@/types/reports";
import { formatCurrency, formatNumber } from "@/lib/format";

export default function EventsSummaryTab({ data }: { data: EventsSummary }) {
  return (
    <div className="space-y-6">
      {/* Top KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Cobrado"
          value={formatCurrency(data.total_amount_collected)}
          tone="green"
        />
        <KpiCard
          label="Pendiente"
          value={formatCurrency(data.total_amount_pending)}
          tone="amber"
        />
        <KpiCard
          label="Entradas emitidas"
          value={formatNumber(data.total_tickets_issued)}
          tone="blue"
        />
        <KpiCard
          label="Eventos activos"
          value={`${data.active_events} / ${data.total_events}`}
          tone="navy"
        />
      </div>

      {/* Order pipeline */}
      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy-400">
          Pipeline de órdenes
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SmallStat
            label="Aprobadas"
            value={data.approved_orders}
            color="text-green-600"
          />
          <SmallStat
            label="Pendientes"
            value={data.pending_orders}
            color="text-amber-600"
          />
          <SmallStat
            label="Cortesías"
            value={data.complimentary_orders}
            color="text-blue-600"
          />
          <SmallStat
            label="Rechazadas"
            value={data.rejected_orders}
            color="text-red-600"
          />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "blue" | "navy";
}) {
  const map = {
    green: "text-green-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    navy: "text-navy-700",
  };
  return (
    <div className="card text-center">
      <p className="text-xs text-navy-400">{label}</p>
      <p className={`text-lg font-bold ${map[tone]}`}>{value}</p>
    </div>
  );
}

function SmallStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-navy-400">{label}</p>
    </div>
  );
}
