interface CompanyAvatarProps {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<CompanyAvatarProps["size"]>, string> = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-xl",
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function CompanyAvatar({ name, color, size = "md" }: CompanyAvatarProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl font-bold text-white ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}
