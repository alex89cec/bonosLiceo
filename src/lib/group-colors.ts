export const GROUP_COLORS = [
  { key: "blue", bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  { key: "red", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  { key: "green", bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  { key: "purple", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  { key: "orange", bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  { key: "pink", bg: "bg-pink-100", text: "text-pink-700", dot: "bg-pink-500" },
  { key: "teal", bg: "bg-teal-100", text: "text-teal-700", dot: "bg-teal-500" },
  { key: "yellow", bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
] as const;

export type GroupColorKey = (typeof GROUP_COLORS)[number]["key"];

const DEFAULT_COLOR = GROUP_COLORS[0]; // blue

export function getGroupColor(key: string | undefined | null) {
  if (!key) return DEFAULT_COLOR;
  return GROUP_COLORS.find((c) => c.key === key) ?? DEFAULT_COLOR;
}
