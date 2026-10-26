// One spelling of a place name, for every language the site speaks.
//
// The place index is matched on this key, so the loader that fills it and the
// lookup that reads it must produce byte-identical keys. They share this file.
// It uses nothing but the standard library, so it runs in Deno (the Edge
// Function) and in Node (the loader) without a build step.
//
// What it folds, and why:
//   - case and Unicode compatibility forms, so "Ｔｏｋｙｏ" and "tokyo" meet;
//   - the combining marks that are optional where they are used: Latin, Greek
//     and Cyrillic accents ("São Paulo", Vietnamese tone marks), Arabic
//     tashkeel and Hebrew points. Indic and Thai marks are NOT folded: there
//     they are vowel signs, part of the word, and stripping them turned Hindi
//     «दिल्ली» into «दलल»;
//   - the three Arabic letter variants people type interchangeably
//     (أ إ آ -> ا, ى -> ي), which is the difference between finding «القاهرة»
//     and not when a phone keyboard offers the wrong alef.
// What it deliberately leaves alone: letters themselves. Turning "ß" into "ss"
// or merging Cyrillic and Latin lookalikes would join places that are not one.

export function placeKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-֑ͯ-ׇً-ٰٟۖ-ۭ]/g, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    // Punctuation people vary freely: hyphens, apostrophes, dots, commas.
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
