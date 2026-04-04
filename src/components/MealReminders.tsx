import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Bell, BellOff, BellRing, Clock, Plus, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface MealReminder {
  id: string;
  label: string;
  time: string; // HH:MM
  enabled: boolean;
}

const STORAGE_KEY = "visionex_meal_reminders";

const DEFAULT_REMINDERS: MealReminder[] = [
  { id: "breakfast", label: "breakfast", time: "07:30", enabled: true },
  { id: "lunch", label: "lunch", time: "12:30", enabled: true },
  { id: "dinner", label: "dinner", time: "19:00", enabled: true },
  { id: "snack1", label: "snack", time: "10:00", enabled: false },
  { id: "snack2", label: "snack2", time: "16:00", enabled: false },
];

const LABELS: Record<string, Record<string, string>> = {
  ar: {
    title: "تنبيهات الوجبات",
    subtitle: "تذكير بمواعيد وجباتك اليومية",
    breakfast: "الفطور",
    lunch: "الغداء",
    dinner: "العشاء",
    snack: "وجبة خفيفة ١",
    snack2: "وجبة خفيفة ٢",
    enable: "تفعيل التنبيهات",
    permissionNeeded: "يجب السماح بالإشعارات في المتصفح",
    reminderFired: "حان موعد",
    addReminder: "إضافة تنبيه",
    custom: "تنبيه مخصص",
    notifyBody: "لا تنسَ تناول وجبتك للحفاظ على نظامك الغذائي! 🍽️",
  },
  en: {
    title: "Meal Reminders",
    subtitle: "Daily reminders for your meals",
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack 1",
    snack2: "Snack 2",
    enable: "Enable Reminders",
    permissionNeeded: "Please allow notifications in your browser",
    reminderFired: "Time for",
    addReminder: "Add Reminder",
    custom: "Custom Reminder",
    notifyBody: "Don't forget your meal to stay on track! 🍽️",
  },
};

function getLabels(lang: string) {
  return LABELS[lang] || LABELS["en"];
}

export default function MealReminders() {
  const { language } = useLanguage();
  const l = getLabels(language);
  const [reminders, setReminders] = useState<MealReminder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_REMINDERS;
    } catch {
      return DEFAULT_REMINDERS;
    }
  });
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const firedRef = useRef<Set<string>>(new Set());

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "denied") toast.error(l.permissionNeeded);
  }, [l]);

  // Check reminders every 30s
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const todayKey = now.toDateString();

      reminders.forEach((r) => {
        const fireKey = `${todayKey}_${r.id}`;
        if (r.enabled && r.time === hhmm && !firedRef.current.has(fireKey)) {
          firedRef.current.add(fireKey);
          const label = l[r.label] || r.label;
          toast.info(`${l.reminderFired} ${label}! 🔔`, { duration: 10000 });

          if (notifPermission === "granted") {
            try {
              new Notification(`${l.reminderFired} ${label}`, {
                body: l.notifyBody,
                icon: "/placeholder.svg",
              });
            } catch {}
          }

          // Voice
          if ("speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance(`${l.reminderFired} ${label}`);
            u.lang = language === "ar" ? "ar-SA" : language;
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
          }
        }
      });
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [reminders, notifPermission, language, l]);

  // Reset fired set at midnight
  useEffect(() => {
    const midnight = () => {
      firedRef.current.clear();
    };
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timeout = setTimeout(midnight, msUntilMidnight);
    return () => clearTimeout(timeout);
  }, []);

  const toggleReminder = (id: string) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const updateTime = (id: string, time: string) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, time } : r)));
  };

  const removeReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const addCustomReminder = () => {
    const id = `custom_${Date.now()}`;
    setReminders((prev) => [
      ...prev,
      { id, label: l.custom, time: "15:00", enabled: true },
    ]);
  };

  return (
    <Card className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 shadow-lg">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-black text-foreground">{l.title}</h3>
          </div>
          {notifPermission !== "granted" && (
            <Button
              size="sm"
              variant="outline"
              onClick={requestPermission}
              className="rounded-xl text-xs gap-1"
            >
              <Bell className="h-3 w-3" />
              {l.enable}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{l.subtitle}</p>

        <div className="space-y-3">
          {reminders.map((r) => {
            const label = l[r.label] || r.label;
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  r.enabled
                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                    : "bg-muted/50 border border-transparent"
                }`}
              >
                <Switch
                  checked={r.enabled}
                  onCheckedChange={() => toggleReminder(r.id)}
                  className="data-[state=checked]:bg-amber-500"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${r.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={r.time}
                    onChange={(e) => updateTime(r.id, e.target.value)}
                    className="w-[100px] h-8 text-sm rounded-lg text-center"
                  />
                </div>
                {r.id.startsWith("custom") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeReminder(r.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addCustomReminder}
          className="w-full rounded-xl gap-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        >
          <Plus className="h-4 w-4" />
          {l.addReminder}
        </Button>
      </CardContent>
    </Card>
  );
}
