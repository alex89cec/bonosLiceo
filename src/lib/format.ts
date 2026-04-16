export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR").format(value);
}

export function formatPercent(value: number): string {
  if (value > 0 && value < 0.1) return "<0.1%";
  return `${Math.round(value * 10) / 10}%`;
}
