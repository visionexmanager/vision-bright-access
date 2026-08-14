---
name: localization-guardian
description: Protect and implement Visionex localization, translations, locale parity, Arabic and RTL behavior, placeholders, plurals, date/number formatting, and language isolation. Use for any user-facing text or locale issue.
---

# Localization guardian

1. Treat source meaning, not English word order, as the contract.
2. Preserve key parity across all locales listed in `AGENTS.md`, including placeholders, markup, plurals, and interpolation types.
3. Use locale-aware number, currency, date, time, list, and plural formatting.
4. Keep Arabic, Persian, and Urdu directionality correct; use logical CSS properties and avoid directional icons without mirroring rules.
5. Do not concatenate translated fragments or embed translatable text in images.
6. Account for text expansion, wrapping, truncation, screen-reader language, and mixed-direction content.
7. Check `LanguageContext` English-string rewriting for unintended substring replacements.
8. Test at least English, Arabic RTL, and one additional locale in the rendered UI for user-facing changes.
