"use client";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}

/**
 * Compact label + native <select> filter, matching the look used in
 * the reports header. Native select gives us a great mobile picker
 * for free.
 */
export default function FilterSelect({
  label,
  value,
  onChange,
  options,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-navy-400 whitespace-nowrap">
        {label}
      </label>
      <div className="relative min-w-0 flex-1 sm:flex-initial">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-lg border border-navy-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-navy-700 transition-colors hover:border-navy-300 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
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
  );
}
