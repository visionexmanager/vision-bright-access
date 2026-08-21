// Everything this assistant can do that is not a photo.
//
// `whatsappVisionModes.ts` owns the five things a picture can be used for and
// prints its own menu. This is the other half — weather, location, the bazaar,
// documents, voice — kept in a separate message rather than appended to that
// one, for the reason the webhook already gives for splitting the welcome from
// the menu: a screen reader reads one message at a time, and a ten-item list
// glued onto a five-item list buries both.
//
// A capability that is not announced does not exist. The senders here cannot
// discover a feature by noticing a new button, so the menu *is* the interface.
//
// Pure and provider-free, so the suite pins every phrase.

/**
 * The non-photo capabilities, as a message.
 *
 * Each line leads with the words that trigger it, because that is what the
 * sender has to say back. Phrased as things to say, not as feature names: "قل
 * «الطقس»" is actionable where "weather support" is a brochure.
 */
export function capabilityMenu(language: "ar" | "en"): string {
  if (language === "ar") {
    return [
      "*وأشياء أخرى أقدر عليها*",
      "",
      "• *الطقس* — قل «الطقس في عمّان»، أو شارك موقعك وأخبرك بطقس مكانك",
      "• *موقعك* — أرسل موقعك من 📎 ثم «الموقع»، وأقول لك أين أنت وما حولك",
      "• *حولي* — أقرب صيدلية أو مطعم أو موقف، بالمسافة والاتجاه",
      "• *السوق* — «عندكم عسل؟» وأبحث في سوق Visionex بالسعر والتوفّر",
      "• *أبيع* — أشرح لك كيف تفتح متجرك وتضيف منتجاتك",
      "• *ملفات* — أرسل PDF أو ملفاً نصياً وألخّصه أو أجيبك عمّا فيه",
      "• *رسالة صوتية* — تكلّم بدل الكتابة، وأقدر أرد بصوت إذا طلبت",
      "",
      "اكتب «قائمة» في أي وقت لتسمع هذه الخيارات مرة أخرى.",
    ].join("\n");
  }
  return [
    "*And a few other things*",
    "",
    "• *Weather* — say \"weather in Amman\", or share your location for where you are",
    "• *Your location* — send it from 📎 → Location and I'll say where you are",
    "• *Near me* — the closest pharmacy, café or bus stop, with distance and direction",
    "• *The bazaar* — \"do you have honey?\" and I'll search listings, prices and stock",
    "• *Selling* — I'll walk you through opening a shop and listing your products",
    "• *Files* — send a PDF or a text file and I'll summarise it or answer questions on it",
    "• *Voice notes* — talk instead of typing, and I can reply out loud if you ask",
    "",
    "Say \"menu\" any time to hear these again.",
  ].join("\n");
}
