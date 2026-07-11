import { parseContent } from "./contentParser";

interface PostContentProps {
  content: string;
  clamp?: boolean;
}

export function PostContent({ content, clamp }: PostContentProps) {
  const segments = parseContent(content);

  return (
    <p className={`whitespace-pre-line text-sm leading-relaxed ${clamp ? "line-clamp-3" : ""}`}>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.value}</span>;
        return (
          <span key={i} className="font-semibold text-primary">
            {seg.value}
          </span>
        );
      })}
    </p>
  );
}
