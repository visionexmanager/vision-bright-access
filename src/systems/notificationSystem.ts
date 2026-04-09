/**
 * In-app notification helpers (client-side, stored in state/localStorage).
 */

export type AppNotification = {
  id: string;
  message: string;
  read: boolean;
  createdAt: number;
};

const STORAGE_KEY = "visionex_notifications";

export function getNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addNotification(message: string): AppNotification[] {
  const list = getNotifications();
  const n: AppNotification = { id: crypto.randomUUID(), message, read: false, createdAt: Date.now() };
  list.unshift(n);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  return list;
}

export function markAsRead(id: string): void {
  const list = getNotifications();
  const n = list.find((x) => x.id === id);
  if (n) n.read = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function markAllRead(): void {
  const list = getNotifications();
  list.forEach((n) => (n.read = true));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}
