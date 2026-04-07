interface Segment {
  value: number;
  color: string;
  label?: string;
}

export default function ProgressBar({
  segments,
  total,
  height = "h-3",
}: {
  segments: Segment[];
  total: number;
  height?: string;
}) {
  if (total === 0) return null;

  return (
    <div className={`w-full overflow-hidden rounded-full bg-gray-100 ${height}`}>
      <div className="flex h-full">
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={i}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={seg.label ? `${seg.label}: ${seg.value} (${Math.round(pct)}%)` : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
