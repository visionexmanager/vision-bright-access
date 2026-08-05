import { Navigate, useParams } from "react-router-dom";
import { getKidsSectionBySlug } from "@/features/visionkids/data/sections";

/**
 * `/kids/:sectionSlug` — the catch-all behind every section card.
 *
 * This used to render the section's icon and title above a "coming soon"
 * box, which is what thirteen of the twenty-five sections showed. Each of
 * those thirteen is a *theme* whose content already existed one route away
 * (a STEM lab, an explorer world, a game category, a studio tool), so the
 * placeholder was hiding working features rather than standing in for
 * missing ones.
 *
 * Now every section declares a real `path` and this route only forwards to
 * it, which keeps old bookmarks and shared `/kids/space` style links
 * working. An unknown slug still goes home.
 */
export default function VisionKidsSection() {
  const { sectionSlug } = useParams<{ sectionSlug: string }>();
  const section = getKidsSectionBySlug(sectionSlug);

  return <Navigate to={section?.path ?? "/kids"} replace />;
}
