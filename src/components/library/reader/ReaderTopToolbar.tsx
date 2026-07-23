import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Bookmark, Expand, Minimize, HelpCircle, List, Moon, Search,
  Settings, Share2, StickyNote, Sun, Hash, MoreVertical, Sparkles, Headphones,
  Highlighter, WifiOff, Info, GraduationCap, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReaderPanelKey } from "@/components/library/reader/ReaderPanelTypes";

interface ReaderTopToolbarProps {
  bookId: string;
  bookTitle: string;
  onOpenPanel: (panel: ReaderPanelKey) => void;
  onGoToPage: (page: number) => void;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onShare: () => void;
  searchEnabled: boolean;
}

export function ReaderTopToolbar({
  bookId, bookTitle, onOpenPanel, onGoToPage, isNightMode, onToggleNightMode,
  isFullscreen, onToggleFullscreen, onShare, searchEnabled,
}: ReaderTopToolbarProps) {
  const { t } = useLanguage();
  const [pageInput, setPageInput] = useState("");
  const [pageOpen, setPageOpen] = useState(false);

  const handleGoToPage = (e: FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page > 0) {
      onGoToPage(page);
      setPageOpen(false);
      setPageInput("");
    }
  };

  return (
    <header role="toolbar" aria-label={t("library.reader.toolbar")} className="flex items-center gap-1 border-b bg-background px-2 py-1.5 sm:px-4">
      <Button asChild variant="ghost" size="icon" aria-label={t("library.reader.back")}>
        <Link to={`/library/books/${bookId}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>

      <span className="ms-1 flex-1 truncate text-sm font-medium">{bookTitle}</span>

      <div className="flex items-center gap-0.5">
        {searchEnabled && (
          <Button variant="ghost" size="icon" onClick={() => onOpenPanel("search")} aria-label={t("library.reader.search")}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <Popover open={pageOpen} onOpenChange={setPageOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("library.reader.goToPage")}>
              <Hash className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <form onSubmit={handleGoToPage} className="flex gap-2">
              <Input type="number" min={1} value={pageInput} onChange={(e) => setPageInput(e.target.value)} placeholder={t("library.reader.pageNumberPlaceholder")} autoFocus />
              <Button type="submit" size="sm">{t("library.reader.go")}</Button>
            </form>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" onClick={() => onOpenPanel("toc")} aria-label={t("library.bookDetails.chapters")}>
          <List className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onOpenPanel("bookmarks")} aria-label={t("library.reader.bookmarks")}>
          <Bookmark className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onOpenPanel("notes")} aria-label={t("library.reader.notes")}>
          <StickyNote className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onShare} aria-label={t("library.actions.share")}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("library.reader.more")}>
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenPanel("highlights")}>
              <Highlighter className="me-2 h-4 w-4" aria-hidden="true" /> {t("library.reader.highlights")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenPanel("ai")}>
              <Sparkles className="me-2 h-4 w-4" aria-hidden="true" /> {t("library.ai.title")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenPanel("readAloud")}>
              <Headphones className="me-2 h-4 w-4" aria-hidden="true" /> {t("library.reader.readAloud")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenPanel("offline")}>
              <WifiOff className="me-2 h-4 w-4" aria-hidden="true" /> {t("library.reader.offline")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenPanel("info")}>
              <Info className="me-2 h-4 w-4" aria-hidden="true" /> {t("library.reader.bookInfo")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenPanel("coach")}>
              <GraduationCap className="me-2 h-4 w-4" aria-hidden="true" /> {t("library.ai.coach.title")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenPanel("accessibility")}>
              <Eye className="me-2 h-4 w-4" aria-hidden="true" /> {t("library.ai.accessibility.title")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={onToggleFullscreen} aria-pressed={isFullscreen} aria-label={t("library.reader.fullscreen")}>
          {isFullscreen ? <Minimize className="h-4 w-4" aria-hidden="true" /> : <Expand className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleNightMode} aria-pressed={isNightMode} aria-label={t("library.reader.nightMode")}>
          {isNightMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onOpenPanel("settings")} aria-label={t("library.reader.settings")}>
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onOpenPanel("help")} aria-label={t("library.reader.help")}>
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
