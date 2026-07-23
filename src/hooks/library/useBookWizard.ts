/**
 * useBookWizard — the Book Creation wizard's submit logic. EPUB/PDF go
 * through the real ingestion pipeline (upload to the existing
 * library-temp-uploads staging bucket, then the library-import-book edge
 * function parses it into a draft with real chapters/cover). Every other
 * supported format (DOCX/TXT/HTML/Markdown/Audiobook/Interactive Book)
 * takes the "blank book" path — createBlankBook, then the author writes
 * content in the Studio editor afterward.
 */

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createBlankBook, type CreateBlankBookInput } from "@/services/library/studio";
import type { LibraryFileType } from "@/lib/types/library-book";

export type WizardFormat = "pdf" | "epub" | "docx" | "txt" | "html" | "markdown" | "audiobook" | "interactive";

const PARSEABLE_FORMATS = new Set<WizardFormat>(["pdf", "epub"]);

export interface WizardSubmitInput extends CreateBlankBookInput {
  format: WizardFormat;
  /** Only for pdf/epub — the raw manuscript file to import. */
  file?: File;
}

export function useBookWizard() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (input: WizardSubmitInput) => {
      setIsSubmitting(true);
      try {
        let bookId: string;

        if (PARSEABLE_FORMATS.has(input.format) && input.file) {
          bookId = await importParseableBook(input.file, input.format as "pdf" | "epub", input);
        } else {
          const book_type: CreateBlankBookInput["book_type"] = input.format === "audiobook" ? "audiobook" : "ebook";
          const { id } = await createBlankBook({ ...input, book_type });
          bookId = id;
        }

        toast({ title: "Book created", description: "Add chapters and finish the details in the editor." });
        navigate(`/library/studio/books/${bookId}`);
        return bookId;
      } catch (err) {
        toast({ title: "Couldn't create this book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate]
  );

  return { submit, isSubmitting };
}

async function importParseableBook(file: File, format: "pdf" | "epub", input: WizardSubmitInput): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first");

  const storagePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage.from("library-temp-uploads").upload(storagePath, file);
  if (uploadErr) throw new Error(uploadErr.message);

  const fileType: LibraryFileType = format;
  const { data, error } = await supabase.functions.invoke("library-import-book", {
    body: {
      storage_path: storagePath,
      file_type: fileType,
      author_id: input.author_id,
      category_id: input.category_id,
      is_free: input.is_free,
      price_vx: input.price_vx,
      price_usd: input.price_usd,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.book.id as string;
}
