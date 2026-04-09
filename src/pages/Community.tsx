import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Users, Radio, Globe } from "lucide-react";
import { DEFAULT_ROOMS, VOICE_ROOM_CONFIGS } from "@/systems/voiceRoomSystem";
import { Link } from "react-router-dom";

export default function Community() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const isAr = lang === "ar";

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            {t("community.title")}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {t("community.subtitle")}
          </p>
        </div>

        {/* Public voice rooms */}
        <div className="mb-12">
          <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            {t("community.voiceRooms")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEFAULT_ROOMS.map((room) => (
              <Card key={room.id} className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    {isAr ? room.nameAr : room.name}
                  </CardTitle>
                  <CardDescription>
                    <Badge variant="outline">
                      <Users className="mr-1 h-3 w-3" /> {t("community.open")}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={!user}>
                    {user ? t("community.joinRoom") : t("community.loginToJoin")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Create private room */}
        {user && (
          <div>
            <h2 className="mb-4 text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              {t("community.createRoom")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VOICE_ROOM_CONFIGS.map((cfg) => (
                <Card key={cfg.type} className="text-center">
                  <CardHeader>
                    <div className="mx-auto text-4xl">{cfg.icon}</div>
                    <CardTitle className="text-lg">{cfg.label}</CardTitle>
                    <CardDescription>
                      {cfg.maxUsers ? `${cfg.maxUsers} ${t("community.users")}` : t("community.unlimited")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge className="mb-3 text-base">{cfg.costVX} VX</Badge>
                    <Button variant="outline" className="w-full">
                      {t("community.create")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-8 rounded-lg border bg-muted/50 p-8 text-center">
            <p className="mb-4 text-muted-foreground">{t("community.loginPrompt")}</p>
            <Button asChild>
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          </div>
        )}
      </section>
    </Layout>
  );
}
