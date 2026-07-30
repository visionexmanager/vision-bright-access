import { CreatorWorkspace } from "@/features/visionkids/components/market/CreatorWorkspace";
import type { ProductType } from "@/features/visionkids/types/market.types";

const TYPES: ProductType[] = ["game", "template", "model3d", "sfx", "prompt", "puzzle"];

export default function DeveloperDashboard() {
  return <CreatorWorkspace kind="developer" allowedTypes={TYPES} emoji="💻"
    titleKey="kids.market.nav.developerDashboard" subtitleKey="kids.market.developerDash.subtitle" canonicalPath="/kids/market/developer" />;
}
