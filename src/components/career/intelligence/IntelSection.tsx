import type { ReactNode } from "react";

interface IntelSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function IntelSection({ id, title, subtitle, children }: IntelSectionProps) {
  return (
    <section id={`intel-${id}`} aria-labelledby={`intel-${id}-heading`} className="scroll-mt-6 border-b intel-border px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div>
          <h2 id={`intel-${id}-heading`} className="text-lg font-bold sm:text-xl">{title}</h2>
          {subtitle && <p className="intel-muted mt-1 text-sm">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
