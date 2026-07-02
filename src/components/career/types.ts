import type { LucideIcon } from "lucide-react";

export interface CareerServiceCardData {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

export interface CareerStatData {
  id: string;
  icon: LucideIcon;
  value: string;
  labelKey: string;
}
