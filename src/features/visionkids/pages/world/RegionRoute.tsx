import { useParams } from "react-router-dom";
import { RegionBySlug } from "@/features/visionkids/components/world/RegionBySlug";

/** Generic region route (/kids/world/region/:slug) — used by Adventure Islands
 *  and any future region, fully data-driven from the catalog. */
export default function RegionRoute() {
  const { slug } = useParams<{ slug: string }>();
  return <RegionBySlug slug={slug} />;
}
