import { useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createAnnouncement, deleteAnnouncement,
} from "@/lib/academy/instructorLocalStore";
import type { AcademyAnnouncementRow } from "@/lib/types/academy-instructor";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorAnnouncementsSectionProps {
  instructorId: string;
  courses: AcademyCourseRow[];
  announcements: AcademyAnnouncementRow[];
  onAnnouncementsChange: () => void;
}

export function InstructorAnnouncementsSection({
  instructorId,
  courses,
  announcements,
  onAnnouncementsChange,
}: InstructorAnnouncementsSectionProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState("all");

  const handlePost = () => {
    if (!title.trim() || !body.trim()) return;
    createAnnouncement(instructorId, title.trim(), body.trim(), courseId === "all" ? null : courseId);
    setTitle("");
    setBody("");
    onAnnouncementsChange();
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-muted/50 border border-border space-y-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإعلان" className="rounded-xl" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص الإعلان..." className="rounded-xl min-h-20" />
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-56 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل طلابي (جميع الدورات)</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handlePost} disabled={!title.trim() || !body.trim()} className="gap-2 rounded-xl">
            <Megaphone className="w-4 h-4" aria-hidden="true" />
            نشر الإعلان
          </Button>
        </div>
      </div>

      {announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">لم تنشر أي إعلان بعد.</p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id} className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-foreground text-sm">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                </div>
                <button onClick={() => { deleteAnnouncement(a.id); onAnnouncementsChange(); }} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="حذف الإعلان">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
