/**
 * useBookAccess — the Phase 4 security fix: decides whether "Read now" /
 * "Download" should render as real, clickable actions for THIS book and
 * THIS viewer, mirroring the same logic already enforced server-side by
 * public.can_access_library_book_content() (RLS on library_book_files/
 * library_chapters): free, OR the viewer is the book's author, OR admin,
 * OR the viewer has actually purchased it. Everything else — including
 * "we don't know yet" while queries are in flight — resolves to NO access,
 * never a default-open state (Phase 4 plan's explicit requirement).
 *
 * Note: this is a UX gate only, not the real security boundary — RLS is
 * the actual enforcement. Getting this wrong just means a confusing UI
 * (a button that 403s), not a data leak.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

export type LibraryBookAccessReason = "free" | "owner" | "admin" | "purchased" | "locked" | null;

export interface LibraryBookAccess {
  canRead: boolean;
  canDownload: boolean;
  isLoading: boolean;
  reason: LibraryBookAccessReason;
}

interface AccessCheckBook {
  id: string;
  is_free: boolean;
  author_id: string;
}

async function checkHasPurchased(userId: string, bookId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("library_purchases")
    .select("id")
    .eq("buyer_id", userId)
    .eq("book_id", bookId)
    .in("status", ["paid", "completed"])
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("Purchase check failed:", error.message);
    return false;
  }
  return !!data;
}

async function checkIsAuthorOwner(userId: string, authorId: string): Promise<boolean> {
  const { data, error } = await supabase.from("library_authors").select("id").eq("id", authorId).eq("user_id", userId).maybeSingle();
  if (error) {
    console.warn("Author-ownership check failed:", error.message);
    return false;
  }
  return !!data;
}

const NOT_LOADED: LibraryBookAccess = { canRead: false, canDownload: false, isLoading: true, reason: null };
const FREE: LibraryBookAccess = { canRead: true, canDownload: true, isLoading: false, reason: "free" };
const LOCKED_SIGNED_OUT: LibraryBookAccess = { canRead: false, canDownload: false, isLoading: false, reason: "locked" };

export function useBookAccess(book: AccessCheckBook | null | undefined): LibraryBookAccess {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const needsCheck = !!book && !book.is_free && !!user;

  const { data: hasPurchased, isLoading: purchaseLoading } = useQuery({
    queryKey: ["library", "access-purchase", book?.id, user?.id],
    queryFn: () => checkHasPurchased(user!.id, book!.id),
    enabled: needsCheck,
  });

  const { data: isAuthorOwner, isLoading: ownerLoading } = useQuery({
    queryKey: ["library", "access-owner", book?.author_id, user?.id],
    queryFn: () => checkIsAuthorOwner(user!.id, book!.author_id),
    enabled: needsCheck,
  });

  if (!book) return NOT_LOADED;
  if (book.is_free) return FREE;
  if (!user) return LOCKED_SIGNED_OUT;

  if (adminLoading || purchaseLoading || ownerLoading) return NOT_LOADED;

  if (isAdmin) return { canRead: true, canDownload: true, isLoading: false, reason: "admin" };
  if (isAuthorOwner) return { canRead: true, canDownload: true, isLoading: false, reason: "owner" };
  if (hasPurchased) return { canRead: true, canDownload: true, isLoading: false, reason: "purchased" };

  return { canRead: false, canDownload: false, isLoading: false, reason: "locked" };
}
