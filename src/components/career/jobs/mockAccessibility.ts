import { Building2, Volume2, Hand, Wifi, Puzzle, Users, Star } from "lucide-react";
import type { AccessibilityFeature } from "./types";

export const ACCESSIBILITY_FEATURES: AccessibilityFeature[] = [
  { id: "accessibleEmployers", icon: Building2, titleKey: "careersPage.accessibility.employers.title", descKey: "careersPage.accessibility.employers.desc" },
  { id: "screenReaderFriendly", icon: Volume2, titleKey: "careersPage.accessibility.screenReader.title", descKey: "careersPage.accessibility.screenReader.desc" },
  { id: "brailleFriendly", icon: Hand, titleKey: "careersPage.accessibility.braille.title", descKey: "careersPage.accessibility.braille.desc" },
  { id: "remoteAccessibility", icon: Wifi, titleKey: "careersPage.accessibility.remote.title", descKey: "careersPage.accessibility.remote.desc" },
  { id: "assistiveTechnology", icon: Puzzle, titleKey: "careersPage.accessibility.assistiveTech.title", descKey: "careersPage.accessibility.assistiveTech.desc" },
  { id: "inclusiveHiring", icon: Users, titleKey: "careersPage.accessibility.inclusiveHiring.title", descKey: "careersPage.accessibility.inclusiveHiring.desc" },
  { id: "accessibilityRating", icon: Star, titleKey: "careersPage.accessibility.rating.title", descKey: "careersPage.accessibility.rating.desc" },
];
