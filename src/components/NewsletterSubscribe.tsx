import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const INTERESTS = [
  { key: "products", labelKey: "newsletter.topic.products", emoji: "🛍️" },
  { key: "services", labelKey: "newsletter.topic.services", emoji: "🔧" },
  { key: "courses", labelKey: "newsletter.topic.courses", emoji: "📚" },
  { key: "games", labelKey: "newsletter.topic.games", emoji: "🎮" },
  { key: "tech-news", labelKey: "newsletter.topic.techNews", emoji: "💻" },
  { key: "global-news", labelKey: "newsletter.topic.globalNews", emoji: "🌍" },
] as const;

export function NewsletterSubscribe() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  function toggleTopic(topic: string) {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers" as any)
      .insert({ email: email.trim().toLowerCase(), topics } as any);

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast({ title: t("newsletter.alreadySubscribed"), variant: "default" });
      } else {
        toast({ title: t("newsletter.error"), variant: "destructive" });
      }
      return;
    }

    playSound("success");
    setSubscribed(true);
    toast({ title: t("newsletter.success") });
  }

  if (subscribed) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <h3 className="text-xl font-bold">{t("newsletter.thankYou")}</h3>
          <p className="text-muted-foreground">{t("newsletter.confirmMsg")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
        <div className="flex items-center gap-3">
          <Mail className="h-7 w-7 text-primary" />
          <div>
            <CardTitle className="text-xl">{t("newsletter.title")}</CardTitle>
            <CardDescription>{t("newsletter.subtitle")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleSubscribe} className="space-y-5">
          <Input
            type="email"
            required
            placeholder={t("newsletter.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />

          <div>
            <p className="mb-3 text-sm font-medium text-foreground">
              {t("newsletter.selectInterests")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {INTERESTS.map((item) => (
                <Label
                  key={item.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    topics.includes(item.key)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Checkbox
                    checked={topics.includes(item.key)}
                    onCheckedChange={() => toggleTopic(item.key)}
                    className="sr-only"
                  />
                  <span>{item.emoji}</span>
                  <span>{t(item.labelKey)}</span>
                </Label>
              ))}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={loading}>
            <Send className="me-2 h-4 w-4" />
            {loading ? t("newsletter.subscribing") : t("newsletter.subscribe")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
