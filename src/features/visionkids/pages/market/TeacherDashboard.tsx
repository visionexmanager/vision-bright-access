import { CreatorWorkspace } from "@/features/visionkids/components/market/CreatorWorkspace";
import type { ProductType } from "@/features/visionkids/types/market.types";

const TYPES: ProductType[] = ["course", "worksheet", "book", "activity", "pdf", "epub", "puzzle"];

export default function TeacherDashboard() {
  return <CreatorWorkspace kind="teacher" allowedTypes={TYPES} emoji="🧑‍🏫"
    titleKey="kids.market.nav.teacherDashboard" subtitleKey="kids.market.teacherDash.subtitle" canonicalPath="/kids/market/teacher" />;
}
