import { CreatorWorkspace } from "@/features/visionkids/components/market/CreatorWorkspace";
import type { ProductType } from "@/features/visionkids/types/market.types";

const TYPES: ProductType[] = ["activity", "template", "music", "sfx", "character", "model3d", "prompt", "story", "video"];

export default function CreatorDashboard() {
  return <CreatorWorkspace kind="creator" allowedTypes={TYPES} emoji="🎨"
    titleKey="kids.market.nav.creatorDashboard" subtitleKey="kids.market.creatorDash.subtitle" canonicalPath="/kids/market/creator" />;
}
