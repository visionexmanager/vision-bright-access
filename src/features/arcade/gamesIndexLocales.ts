import { translations as en } from "@/i18n/en";
import { translations as ar } from "@/i18n/ar";
import { translations as ur } from "@/i18n/ur";
import { translations as hi } from "@/i18n/hi";
import { translations as id } from "@/i18n/id";
import { translations as ja } from "@/i18n/ja";
import { translations as it } from "@/i18n/it";
import { translations as ko } from "@/i18n/ko";
import { translations as nl } from "@/i18n/nl";
import { translations as pl } from "@/i18n/pl";
import { translations as vi } from "@/i18n/vi";
import { translations as bn } from "@/i18n/bn";
import { translations as fa } from "@/i18n/fa";
import { translations as es } from "@/i18n/es";
import { translations as de } from "@/i18n/de";
import { translations as pt } from "@/i18n/pt";
import { translations as zh } from "@/i18n/zh";
import { translations as tr } from "@/i18n/tr";
import { translations as fr } from "@/i18n/fr";
import { translations as ru } from "@/i18n/ru";

/**
 * The site's own dictionaries, by locale, for the generator to read.
 *
 * Kept in its own module because the generator is the only thing that needs all
 * twenty at once: importing them from `gamesIndex.ts` would pull every locale
 * into any bundle that touches the index shape. The snapshot is written once,
 * at build time, and the edge function reads only the JSON.
 *
 * The twenty are the twenty the WhatsApp channel speaks, in that order — see
 * `supabase/functions/_shared/whatsappLanguages.ts`, which the parity test
 * pins this against.
 */
const DICTIONARIES: Record<string, Record<string, string>> = {
  en, ar, ur, hi, id, ja, it, ko, nl, pl, vi, bn, fa, es, de, pt, zh, tr, fr, ru,
};

export const SUPPORTED_LOCALES = Object.keys(DICTIONARIES);

export const translationsFor = (locale: string): Record<string, string> =>
  DICTIONARIES[locale] ?? {};
