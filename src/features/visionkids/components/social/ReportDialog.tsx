import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFileReport } from "@/features/visionkids/hooks/social/useReports";
import type { ReportContentType } from "@/features/visionkids/types/social.types";

const REASONS = ["inappropriate_content", "bullying", "spam", "personal_info", "unsafe_request", "other"];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ReportContentType;
  contentId: string;
}

export function ReportDialog({ open, onOpenChange, contentType, contentId }: ReportDialogProps) {
  const { t } = useLanguage();
  const fileReport = useFileReport();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");

  const handleSubmit = () => {
    fileReport.mutate({ contentType, contentId, reason, details: details || undefined }, {
      onSuccess: () => { onOpenChange(false); setDetails(""); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" /> {t("kids.social.report.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => <SelectItem key={r} value={r}>{t(`kids.social.report.reason.${r}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("kids.social.report.detailsPlaceholder")} rows={4} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("kids.social.cancel")}</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={fileReport.isPending}>{t("kids.social.report.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
