/**
 * The support WhatsApp number. Messages to it reach whatsapp-webhook and are
 * answered by the assistant; the previous Lebanese number was a personal handset
 * with no webhook behind it, so nothing sent there was ever seen by the server.
 */
export const SUPPORT_WHATSAPP_NUMBER = "447732729713";
export const SUPPORT_WHATSAPP_DISPLAY = "+44 7732 729713";

export function supportWhatsAppLink(text: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
