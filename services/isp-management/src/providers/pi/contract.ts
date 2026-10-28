/**
 * Every PI path and parameter this adapter uses. Paths are the ones the PI web
 * app itself calls (read from its public client bundle). `verified: false`
 * means the path exists but its query-parameter names and response shape have
 * not been observed against a live, authenticated response.
 *
 * `pageSize` was read off the panel's own call (`/api/users?pageIndex=1&pageSize=10&
 * sortField=username&sortOrder=asc&usersFilter=my&status=0`). The search
 * parameter's name has not been seen, so `search` is still a guess.
 */
export const PI_CONTRACT = {
  usersList: { path: "/api/users", searchParam: "search", sizeParam: "pageSize", verified: false },
  userGet: { path: "/api/user/", idParam: "id", verified: false },
  userOverview: { path: "/api/user/overview/", idParam: "id", verified: false },
  userInvoices: { path: "/api/user/invoices/", idParam: "id", verified: false },
  userRefills: { path: "/api/user/refills", idParam: "id", verified: false },
  sessionsList: { path: "/api/sessions/list", userParam: "username", verified: false },
  stats: { path: "/api/getstats", verified: false },
} as const;
