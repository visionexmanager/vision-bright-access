import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigate } from "react-router-dom";
import { Camera, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large (max 2MB)", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: t("profile.error"), variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Add cache buster
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(newUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
      })
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      toast({ title: t("profile.error"), variant: "destructive" });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast({ title: t("profile.saved") });
  };

  return (
    <Layout>
      <section className="mx-auto max-w-lg px-4 py-10" aria-labelledby="profile-heading">
        <h1 id="profile-heading" className="mb-2 text-3xl font-bold">
          {t("profile.title")}
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">{t("profile.subtitle")}</p>

        <Card>
          <CardContent className="flex flex-col items-center gap-6 p-8">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-primary/20">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="text-3xl font-bold">
                  {(displayName || user.email || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 end-0 h-9 w-9 rounded-full shadow"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label={t("profile.changeAvatar")}
              >
                <Camera className="h-4 w-4" />
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            {uploading && (
              <p className="text-sm text-muted-foreground">{t("profile.uploading")}</p>
            )}

            {/* Display Name */}
            <div className="w-full space-y-2">
              <Label htmlFor="displayName" className="text-base font-semibold">
                {t("profile.displayName")}
              </Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  className="text-base"
                />
              )}
            </div>

            {/* Email (read-only) */}
            <div className="w-full space-y-2">
              <Label className="text-base font-semibold">Email</Label>
              <Input
                value={user.email || ""}
                disabled
                className="text-base text-muted-foreground"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || isLoading}
              size="lg"
              className="w-full text-base font-semibold"
            >
              <Save className="me-2 h-5 w-5" aria-hidden="true" />
              {saving ? t("profile.saving") : t("profile.save")}
            </Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
