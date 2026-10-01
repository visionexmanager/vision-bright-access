/**
 * Every PI path and parameter this adapter uses. Paths are the ones the PI web
 * app itself calls (read from its public client bundle). `verified: false`
 * means the path exists but its query-parameter names and response shape have
 * not been observed against a live, authenticated response.
 */
export const PI_CONTRACT = {
  usersList: { path: "/api/users", searchParam: "search", sizeParam: "page_size", verified: false },
  userGet: { path: "/api/user/", idParam: "id", verified: false },
  userOverview: { path: "/api/user/overview/", idParam: "id", verified: false },
  userInvoices: { path: "/api/user/invoices/", idParam: "id", verified: false },
  userRefills: { path: "/api/user/refills", idParam: "id", verified: false },
  sessionsList: { path: "/api/sessions/list", userParam: "username", verified: false },
  stats: { path: "/api/getstats", verified: false },
} as const;
