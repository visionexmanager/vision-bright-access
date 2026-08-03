const BLOCKED_PREFIXES = [
  "/visionkids",
  "/kids",
  "/auth",
  "/login",
  "/signup",
  "/reset-password",
  "/admin",
  "/legal",
  "/privacy-policy",
  "/terms-of-use",
  "/checkout",
  "/payment",
  "/settings",
  "/newsletter/preferences",
];

export function isAdEligiblePath(pathname: string) {
  const normalized = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  return !BLOCKED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

