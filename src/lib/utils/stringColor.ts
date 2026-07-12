// Deterministic color from a name string — used for company/user avatars
// where the DB has no dedicated color column (e.g. `companies`, `jobs`).

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6", "#ef4444",
];

export function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
