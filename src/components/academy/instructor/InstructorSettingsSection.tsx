import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";
import { updateMyInstructorProfile } from "@/lib/academy/instructorLocalStore";
import type { AcademyInstructorRow } from "@/lib/types/academy-modules";

interface InstructorSettingsSectionProps {
  instructor: AcademyInstructorRow;
  onSaved: (updated: AcademyInstructorRow) => void;
}

export function InstructorSettingsSection({ instructor, onSaved }: InstructorSettingsSectionProps) {
  const [name, setName] = useState(instructor.name);
  const [headline, setHeadline] = useState(instructor.headline ?? "");
  const [bio, setBio] = useState(instructor.bio ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(instructor.portfolio_url ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(instructor.social_links.website ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const updated = updateMyInstructorProfile(instructor.user_id ?? "", {
      name: name.trim() || instructor.name,
      headline: headline.trim() || null,
      bio: bio.trim() || null,
      portfolio_url: portfolioUrl.trim() || null,
      social_links: { ...instructor.social_links, website: websiteUrl.trim() || undefined },
    });
    if (updated) {
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <label htmlFor="settings-name" className="text-sm font-bold text-foreground">الاسم الظاهر</label>
        <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1.5" />
      </div>
      <div>
        <label htmlFor="settings-headline" className="text-sm font-bold text-foreground">العنوان المهني</label>
        <Input id="settings-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} className="rounded-xl mt-1.5" />
      </div>
      <div>
        <label htmlFor="settings-bio" className="text-sm font-bold text-foreground">نبذة عنك</label>
        <Textarea id="settings-bio" value={bio} onChange={(e) => setBio(e.target.value)} className="rounded-xl mt-1.5 min-h-24" />
      </div>
      <div>
        <label htmlFor="settings-portfolio" className="text-sm font-bold text-foreground">رابط معرض الأعمال</label>
        <Input id="settings-portfolio" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://..." className="rounded-xl mt-1.5" />
      </div>
      <div>
        <label htmlFor="settings-website" className="text-sm font-bold text-foreground">الموقع الإلكتروني</label>
        <Input id="settings-website" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." className="rounded-xl mt-1.5" />
      </div>
      <Button onClick={handleSave} className="gap-2 rounded-xl">
        {saved ? <Check className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
        {saved ? "تم الحفظ" : "حفظ التغييرات"}
      </Button>
    </div>
  );
}
