import { useCallback, useEffect, useMemo, useState } from "react";
import { useMyMemberships } from "@/features/visionkids/hooks/enterprise/useEnterprise";
import { STAFF_ROLES, ADMIN_ROLES } from "@/features/visionkids/data/enterpriseConfig";
import type { MyMembership, OrgRole } from "@/features/visionkids/types/enterprise.types";

const KEY = "kids:current-org";
const EVENT = "visionkids:org-change";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

/** The caller's currently-selected organization + role helpers. Selection is
 *  persisted to localStorage and synced across components via a custom event,
 *  so the org switcher updates every enterprise page without a provider. */
export function useCurrentOrg() {
  const { data: memberships = [], isLoading } = useMyMemberships();
  const [storedId, setStoredId] = useState<string | null>(() => readStored());

  useEffect(() => {
    const onChange = () => setStoredId(readStored());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  // Fall back to the first membership when nothing valid is stored.
  const current: MyMembership | null = useMemo(() => {
    if (memberships.length === 0) return null;
    return memberships.find((m) => m.org_id === storedId) ?? memberships[0];
  }, [memberships, storedId]);

  const setOrgId = useCallback((id: string) => {
    window.localStorage.setItem(KEY, id);
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);

  const role = (current?.role ?? null) as OrgRole | null;
  return {
    memberships,
    isLoading,
    orgId: current?.org_id ?? null,
    org: current?.organization ?? null,
    role,
    isStaff: !!role && STAFF_ROLES.includes(role),
    isAdmin: !!role && ADMIN_ROLES.includes(role),
    setOrgId,
  };
}
