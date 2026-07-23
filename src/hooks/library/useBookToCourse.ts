import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookCourseLink, convertBookToCourse } from "@/services/library/bookToCourse";

export function useBookToCourse(bookId: string) {
  const queryClient = useQueryClient();
  const [isConverting, setIsConverting] = useState(false);

  const { data: link, isLoading } = useQuery({
    queryKey: queryKeys.library.bookCourseLink(bookId),
    queryFn: () => fetchBookCourseLink(bookId),
    enabled: !!bookId,
  });

  const convert = async (title: string, level: string): Promise<string | null> => {
    setIsConverting(true);
    try {
      const courseId = await convertBookToCourse(bookId, title, level);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.bookCourseLink(bookId) });
      toast({ title: "Course created!", description: "Your book is now available as an Academy course." });
      return courseId;
    } catch (err) {
      toast({ title: "Couldn't convert to a course", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsConverting(false);
    }
  };

  return { link, isLoading, isConverting, convert };
}
