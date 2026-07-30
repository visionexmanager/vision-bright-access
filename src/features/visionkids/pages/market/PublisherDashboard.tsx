import { CreatorWorkspace } from "@/features/visionkids/components/market/CreatorWorkspace";
import type { ProductType } from "@/features/visionkids/types/market.types";

const TYPES: ProductType[] = ["book", "epub", "pdf", "audio", "story", "bundle"];

export default function PublisherDashboard() {
  return <CreatorWorkspace kind="publisher" allowedTypes={TYPES} emoji="📚"
    titleKey="kids.market.nav.publisherDashboard" subtitleKey="kids.market.publisherDash.subtitle" canonicalPath="/kids/market/publisher" />;
}
