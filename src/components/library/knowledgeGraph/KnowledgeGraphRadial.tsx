import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";
import type { LibraryKgConnectedEntity, LibraryKgEntityRow } from "@/services/library/knowledgeGraph";

interface KnowledgeGraphRadialProps {
  center: LibraryKgEntityRow;
  connections: LibraryKgConnectedEntity[];
  onNavigate: (slug: string) => void;
}

const SIZE = 440;
const CENTER = SIZE / 2;
const RADIUS = 170;
const NODE_R = 10;
const CENTER_R = 16;

/**
 * Lightweight custom SVG radial graph — center entity with its connections
 * arranged in a circle around it, colored by entity_type, clickable to
 * re-center. No graph-viz dependency: the fan-out per entity is small enough
 * (typically under a couple dozen) that force-directed layout isn't needed.
 */
export function KnowledgeGraphRadial({ center, connections, onNavigate }: KnowledgeGraphRadialProps) {
  const { t } = useLanguage();

  const positioned = useMemo(() => {
    const n = connections.length;
    return connections.map((entity, i) => {
      const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
      return { entity, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
    });
  }, [connections]);

  const centerColor = KG_ENTITY_TYPE_COLORS[center.entity_type];

  return (
    <div className="space-y-4">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t("library.knowledgeGraph.diagramLabel").replace("{name}", center.name)}
        className="mx-auto h-auto w-full max-w-[440px]"
      >
        {positioned.map(({ entity, x, y }) => (
          <line key={`edge-${entity.id}`} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="currentColor" strokeWidth={1.5} className="text-border" />
        ))}

        {positioned.map(({ entity, x, y }) => {
          const color = KG_ENTITY_TYPE_COLORS[entity.entity_type];
          return (
            <g
              key={entity.id}
              tabIndex={0}
              role="button"
              aria-label={`${entity.name} (${t(`library.knowledgeGraph.entityType.${entity.entity_type}`)})`}
              className="cursor-pointer focus-visible:outline-none"
              onClick={() => onNavigate(entity.slug)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate(entity.slug); } }}
            >
              <circle cx={x} cy={y} r={NODE_R + 6} fill="transparent" className="focus-visible:fill-ring/20" />
              <circle cx={x} cy={y} r={NODE_R} fill={color.fill} stroke="var(--background)" strokeWidth={2} />
              <text
                x={x}
                y={y + NODE_R + 14}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-medium"
              >
                {entity.name.length > 18 ? `${entity.name.slice(0, 17)}…` : entity.name}
              </text>
            </g>
          );
        })}

        <circle cx={CENTER} cy={CENTER} r={CENTER_R} fill={centerColor.fill} stroke="var(--background)" strokeWidth={3} />
        <text x={CENTER} y={CENTER + CENTER_R + 18} textAnchor="middle" className="fill-foreground text-sm font-semibold">
          {center.name.length > 24 ? `${center.name.slice(0, 23)}…` : center.name}
        </text>
      </svg>

      {connections.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("library.knowledgeGraph.connectionsList")}</p>
          <ul className="space-y-1.5">
            {connections.map((entity) => (
              <li key={entity.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(entity.slug)}
                  className={`text-sm underline-offset-2 hover:underline ${KG_ENTITY_TYPE_COLORS[entity.entity_type].text}`}
                >
                  {entity.name}
                </button>
                <span className="ml-1.5 text-xs text-muted-foreground">— {entity.relation_type}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
