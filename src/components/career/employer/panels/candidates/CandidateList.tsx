import { useLanguage } from "@/contexts/LanguageContext";
import { CandidateCard } from "./CandidateCard";
import type { Candidate } from "../../types";

interface CandidateListProps {
  candidates: Candidate[];
  onOpen: (id: string) => void;
}

export function CandidateList({ candidates, onOpen }: CandidateListProps) {
  const { t } = useLanguage();

  if (candidates.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("employerDash.candidates.empty")}</p>;
  }

  return (
    <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {candidates.map((c) => (
        <li key={c.id}>
          <CandidateCard candidate={c} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
