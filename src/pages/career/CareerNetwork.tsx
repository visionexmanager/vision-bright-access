import { lazy, Suspense, type LazyExoticComponent } from "react";
import { NetworkLayout } from "@/components/career/network/NetworkLayout";
import { useNetwork } from "@/contexts/NetworkContext";
import { SkeletonCard } from "@/components/career/jobs/SkeletonCard";
import type { NetworkSection } from "@/components/career/network/types";

const Feed = lazy(() => import("@/components/career/network/panels/Feed").then((m) => ({ default: m.Feed })));
const ProfilePanel = lazy(() => import("@/components/career/network/panels/ProfilePanel").then((m) => ({ default: m.ProfilePanel })));
const ConnectionsPanel = lazy(() => import("@/components/career/network/panels/ConnectionsPanel").then((m) => ({ default: m.ConnectionsPanel })));

const PANEL_COMPONENTS: Record<NetworkSection, LazyExoticComponent<() => JSX.Element>> = {
  feed: Feed,
  profile: ProfilePanel,
  connections: ConnectionsPanel,
};

function ActivePanel() {
  const { activeSection } = useNetwork();
  const Panel = PANEL_COMPONENTS[activeSection];

  return (
    <Suspense fallback={<SkeletonCard count={3} />}>
      <Panel />
    </Suspense>
  );
}

export default function CareerNetwork() {
  return (
    <NetworkLayout>
      <ActivePanel />
    </NetworkLayout>
  );
}
