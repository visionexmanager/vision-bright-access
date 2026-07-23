import { FormEvent, useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ReportContentDialogProps {
  contentType: "library_book" | "library_review" | "library_discussion_topic" | "library_discussion_reply" | "library_club" | "library_reader_profile";
  contentId: string;
  iconOnly?: boolean;
}

const REASONS = ["spam", "inappropriate", "copyright", "inaccurate", "other"] as const;

/** Generic report dialog reused for both "report a book" and "report a
 *  review" — inserts directly into the existing content_reports table
 *  (20260422000000_admin_panel_expansion.sql), which already has a real
 *  user-INSERT RLS policy. No new backend needed. */
export function ReportContentDialog({ contentType, contentId, iconOnly }: ReportContentDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("content_reports").insert({
        reporter_id: user.id,
        content_type: contentType,
        content_id: contentId,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      toast({ title: t("library.report.submitted") });
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (err) {
      toast({ title: t("library.report.failed"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("library.report.action")}>
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Flag className="h-4 w-4" aria-hidden="true" /> {t("library.report.action")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.report.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="report-reason" className="mb-1.5 block text-sm font-medium">{t("library.report.reasonLabel")}</label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger id="report-reason">
                <SelectValue placeholder={t("library.report.reasonPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{t(`library.report.reason.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="report-details" className="mb-1.5 block text-sm font-medium">{t("library.report.detailsLabel")}</label>
            <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!reason || submitting}>{t("library.report.submit")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
