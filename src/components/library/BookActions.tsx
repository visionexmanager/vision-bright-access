import { Link } from "react-router-dom";
import { BookOpen, Coins, Headphones, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/library/BookmarkButton";
import { FavoriteButton } from "@/components/library/FavoriteButton";
import { DownloadButton } from "@/components/library/DownloadButton";
import { ShareButton } from "@/components/library/ShareButton";
import { AddToReadingListPopover } from "@/components/library/AddToReadingListPopover";
import { ReportContentDialog } from "@/components/library/ReportContentDialog";
import { WishlistButton } from "@/components/library/marketplace/WishlistButton";
import { GiftPurchaseDialog } from "@/components/library/marketplace/GiftPurchaseDialog";
import { LicensePurchaseDialog } from "@/components/library/marketplace/LicensePurchaseDialog";
import { PurchaseOptionsDialog } from "@/components/library/marketplace/PurchaseOptionsDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePurchaseBook } from "@/hooks/library/usePurchaseBook";
import { useBorrowBook } from "@/hooks/library/useBorrowBook";
import { useLibraryCart } from "@/hooks/library/useLibraryCart";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";
import type { LibraryBookAccess } from "@/hooks/library/useBookAccess";
import type { LibraryBookFormat } from "@/lib/types/library-book";

interface BookActionsProps {
  bookId: string;
  bookTitle: string;
  coverImageUrl?: string | null;
  access: LibraryBookAccess;
  formats: LibraryBookFormat[];
  priceVx: number | null;
  priceUsd: number | null;
  lendingEnabled: boolean;
  isOnShelf: boolean;
  isFavorite: boolean;
  isDownloaded: boolean;
  onToggleShelf: () => void;
  onToggleFavorite: () => void;
  onToggleDownload: () => void;
}

/**
 * Security: the "Read now"/"Listen now"/download actions only render as
 * real, clickable links once `access` (useBookAccess) confirms the viewer
 * can actually access this book — free, owned, purchased, borrowed, or
 * admin. While access is unresolved or denied, this shows a loading state
 * or real "Purchase with VX"/"Borrow" actions instead, never a live link
 * that would just 403.
 */
export function BookActions({
  bookId, bookTitle, coverImageUrl, access, formats, priceVx, priceUsd, lendingEnabled,
  isOnShelf, isFavorite, isDownloaded, onToggleShelf, onToggleFavorite, onToggleDownload,
}: BookActionsProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { purchase, isPurchasing } = usePurchaseBook(bookId);
  const { borrow, isLoading: borrowLoading, borrowNow, returnNow } = useBorrowBook(lendingEnabled ? bookId : undefined);
  const { items: cartItems, addItem: addToCart } = useLibraryCart();
  const isInCart = cartItems.some((i) => i.bookId === bookId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {access.isLoading ? (
        <Button size="lg" disabled>
          <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
          {t("library.explorer.checkingAccess")}
        </Button>
      ) : access.canRead ? (
        <>
          <Button asChild size="lg" onClick={() => void logLibraryAnalyticsEvent("reading_started", { userId: user?.id ?? null, entityType: "book", entityId: bookId })}>
            <Link to={`/library/read/${bookId}`}>
              <BookOpen className="me-2 h-4 w-4" aria-hidden="true" />
              {t("library.actions.readNow")}
            </Link>
          </Button>
          {formats.includes("audiobook") && (
            <Button asChild size="lg" variant="secondary" onClick={() => void logLibraryAnalyticsEvent("listening_started", { userId: user?.id ?? null, entityType: "book", entityId: bookId })}>
              <Link to={`/library/read/${bookId}`}>
                <Headphones className="me-2 h-4 w-4" aria-hidden="true" />
                {t("library.actions.listenNow")}
              </Link>
            </Button>
          )}
        </>
      ) : (
        <>
          <Button
            size="lg"
            variant="secondary"
            onClick={async () => {
              const ok = await purchase();
              if (ok) void logLibraryAnalyticsEvent("purchase", { userId: user?.id ?? null, entityType: "book", entityId: bookId });
            }}
            disabled={isPurchasing || !user}
          >
            {isPurchasing ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Coins className="me-2 h-4 w-4" aria-hidden="true" />}
            {priceVx ? `${t("library.explorer.purchaseFor")} ${priceVx} VX` : priceUsd ? `${t("library.explorer.purchaseFor")} $${priceUsd}` : t("library.explorer.purchaseFor")}
          </Button>
          {user && priceUsd != null && <PurchaseOptionsDialog bookId={bookId} priceUsd={priceUsd} />}
          {user && (
            <Button
              size="lg"
              variant="outline"
              disabled={isInCart}
              onClick={() => addToCart({ bookId, title: bookTitle, coverImageUrl: coverImageUrl ?? null, priceVx, priceUsd })}
            >
              <ShoppingCart className="me-2 h-4 w-4" aria-hidden="true" />
              {isInCart ? t("library.cart.inCart") : t("library.cart.addToCart")}
            </Button>
          )}
          {lendingEnabled && user && (
            borrow ? (
              <Button size="lg" variant="outline" onClick={() => void returnNow()} disabled={borrowLoading}>
                {t("library.actions.returnBook")}
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={() => void borrowNow()} disabled={borrowLoading}>
                {t("library.actions.borrow")}
              </Button>
            )
          )}
          {user && (priceVx != null || priceUsd != null) && (
            <LicensePurchaseDialog bookId={bookId} bookTitle={bookTitle} priceVx={priceVx} priceUsd={priceUsd} />
          )}
        </>
      )}

      <BookmarkButton active={isOnShelf} onToggle={onToggleShelf} />
      <FavoriteButton
        active={isFavorite}
        onToggle={() => {
          if (!isFavorite) void logLibraryAnalyticsEvent("favorite_added", { userId: user?.id ?? null, entityType: "book", entityId: bookId });
          onToggleFavorite();
        }}
      />
      {user && <WishlistButton bookId={bookId} />}
      {user && (priceVx != null || priceUsd != null) && (
        <GiftPurchaseDialog bookId={bookId} bookTitle={bookTitle} priceVx={priceVx} priceUsd={priceUsd} />
      )}
      {access.canDownload && (
        <DownloadButton
          active={isDownloaded}
          onToggle={() => {
            if (!isDownloaded) void logLibraryAnalyticsEvent("download", { userId: user?.id ?? null, entityType: "book", entityId: bookId });
            onToggleDownload();
          }}
        />
      )}
      {user && <AddToReadingListPopover bookId={bookId} />}
      <ShareButton
        title={bookTitle}
        text={t("library.share.checkOutBook").replace("{title}", bookTitle)}
        url={`${window.location.origin}/library/books/${bookId}`}
        onShared={() => void logLibraryAnalyticsEvent("share", { userId: user?.id ?? null, entityType: "book", entityId: bookId })}
      />
      {user && <ReportContentDialog contentType="library_book" contentId={bookId} iconOnly />}
    </div>
  );
}
