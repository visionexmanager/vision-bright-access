/**
 * The space between the two halves of a split headline (`home.title` and
 * `home.titleHighlight`). The English string ends in a space; most other
 * locales' do not, so the words ran together ("всё" + "в" + "одну" read as
 * "водну" to a screen reader). Japanese and Chinese are written without spaces.
 */
export function headlineGap(lang: string, lead: string): string {
  if (/\s$/.test(lead) || lang === "ja" || lang === "zh") return "";
  return " ";
}
