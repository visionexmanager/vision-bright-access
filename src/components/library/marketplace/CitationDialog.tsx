import { useState } from "react";
import { Quote as QuoteIcon, Copy, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCitation, CITATION_FORMATS, type CitationFormat } from "@/lib/library/citations";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookRow } from "@/lib/types/library-book";

interface CitationDialogProps {
  book: LibraryBookRow;
}

export function CitationDialog({ book }: CitationDialogProps) {
  const { t } = useLanguage();
  const [format, setFormat] = useState<CitationFormat>("apa");

  const citation = formatCitation(book, format);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      toast({ title: t("library.citation.copied") });
    } catch {
      toast({ title: t("library.citation.copyFailed"), variant: "destructive" });
    }
  };

  const download = () => {
    const ext = format === "bibtex" ? "bib" : format === "ris" ? "ris" : "txt";
    const blob = new Blob([citation], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book.slug}-citation.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <QuoteIcon className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.citation.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.citation.title")}</DialogTitle>
        </DialogHeader>
        <Tabs value={format} onValueChange={(v) => setFormat(v as CitationFormat)}>
          <TabsList>
            {CITATION_FORMATS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}
          </TabsList>
          {CITATION_FORMATS.map((f) => (
            <TabsContent key={f.value} value={f.value}>
              <pre className="whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm">{citation}</pre>
            </TabsContent>
          ))}
        </Tabs>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => void copy()}>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.citation.copy")}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={download}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.citation.download")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
