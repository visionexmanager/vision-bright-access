import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, X, Merge, Inbox } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useImportReviewQueue } from "@/hooks/library/useImportReviewQueue";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryImportReview() {
  const { t } = useLanguage();
  const { queue, isLoading, approve, reject, markDuplicate } = useImportReviewQueue();
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  return (
    <Layout>
      <LibraryLayout title={t("library.importReview.title")} breadcrumb={[{ label: t("library.importReview.title") }]}>
        <p className="mb-6 text-sm text-muted-foreground">{t("library.importReview.description")}</p>

        {isLoading ? (
          <SkeletonLoader variant="list" count={3} />
        ) : queue.length === 0 ? (
          <EmptyState icon={<Inbox className="h-10 w-10" />} title={t("library.importReview.empty")} />
        ) : (
          <div className="space-y-4">
            {queue.map((book) => (
              <Card key={book.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    {book.cover_image_url && <img src={book.cover_image_url} alt="" className="h-24 w-16 rounded object-cover" />}
                    <div>
                      <Link to={`/library/books/${book.id}`} className="font-semibold text-primary hover:underline">{book.title}</Link>
                      <p className="text-sm text-muted-foreground">{book.author_name}</p>
                      <p className="text-xs text-muted-foreground">{book.language.toUpperCase()} · {book.importSource}</p>
                    </div>
                  </div>
                  {book.potentialDuplicateOf && (
                    <Badge variant="destructive" className="gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("library.importReview.possibleDuplicate").replace("{title}", book.potentialDuplicateTitle ?? "")}
                    </Badge>
                  )}
                </div>

                <p className="line-clamp-3 text-sm text-muted-foreground">{book.description}</p>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <Textarea
                      placeholder={t("library.importReview.rejectNotePlaceholder")}
                      value={rejectNotes[book.id] ?? ""}
                      onChange={(e) => setRejectNotes((prev) => ({ ...prev, [book.id]: e.target.value }))}
                      rows={1}
                      className="min-h-0"
                    />
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={() => void approve(book.id)}>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.importReview.approve")}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void reject(book.id, rejectNotes[book.id] ?? "")}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.importReview.reject")}
                  </Button>
                  {book.potentialDuplicateOf && book.potentialDuplicateTitle && (
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void markDuplicate(book.id, book.potentialDuplicateTitle!)}>
                      <Merge className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.importReview.markDuplicate")}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
