// The website assistant's conversation, kept for a day in the user's own
// browser so a reload or a page change does not end it.
//
// Browser storage only: nothing here is sent anywhere it was not already
// going. The key carries the signed-in user's id (or "guest"), so a second
// person on the same device never loads the first one's chat, and every read
// and write tolerates storage being unavailable.

export const CHAT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
export const CHAT_HISTORY_MAX = 80;

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Envelope {
  savedAt: number;
  messages: StoredMessage[];
}

export function chatHistoryKey(userId: string | null | undefined, assistantId?: string): string {
  return `visionex.chat.v1.${userId ?? "guest"}.${assistantId ?? "general"}`;
}

function valid(item: unknown): item is StoredMessage {
  const m = item as Partial<StoredMessage> | null;
  return !!m && typeof m.id === "string" && typeof m.content === "string"
    && (m.role === "user" || m.role === "assistant");
}

export function loadChatHistory(key: string, now = Date.now(), storage?: Pick<Storage, "getItem" | "removeItem">): StoredMessage[] {
  try {
    const store = storage ?? window.localStorage;
    const raw = store.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Envelope> | null;
    if (!parsed || typeof parsed.savedAt !== "number" || now - parsed.savedAt > CHAT_HISTORY_TTL_MS || !Array.isArray(parsed.messages)) {
      store.removeItem(key);
      return [];
    }
    return parsed.messages.filter(valid).slice(-CHAT_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function clearChatHistory(key: string, storage?: Pick<Storage, "removeItem">): void {
  try {
    (storage ?? window.localStorage).removeItem(key);
  } catch {
    // Nothing stored that we could reach.
  }
}

export function saveChatHistory(key: string, messages: StoredMessage[], now = Date.now(), storage?: Pick<Storage, "setItem">): void {
  try {
    const store = storage ?? window.localStorage;
    // Failed turns ("⚠️ …") are not part of the conversation worth resuming.
    const keep = messages.filter((m) => !(m.role === "assistant" && m.content.startsWith("⚠️"))).slice(-CHAT_HISTORY_MAX);
    // An empty list never erases: on first render the state is empty before the
    // stored chat has been loaded. Ending a chat goes through clearChatHistory.
    if (keep.length > 0) store.setItem(key, JSON.stringify({ savedAt: now, messages: keep } satisfies Envelope));
  } catch {
    // Private mode or a full quota: the chat still works, it just will not resume.
  }
}
