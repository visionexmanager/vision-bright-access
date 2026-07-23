import { FormEvent, useState } from "react";
import { Check, ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { useReadingLists } from "@/hooks/library/useReadingLists";

interface AddToReadingListPopoverProps {
  bookId: string;
}

export function AddToReadingListPopover({ bookId }: AddToReadingListPopoverProps) {
  const { t } = useLanguage();
  const { lists, createList, addBookToList } = useReadingLists();
  const [newListName, setNewListName] = useState("");

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    void createList(newListName.trim());
    setNewListName("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("library.actions.addToReadingList")}>
          <ListPlus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <p className="text-sm font-medium">{t("library.actions.addToReadingList")}</p>
        {lists.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {lists.map((list) => {
              const alreadyIn = list.book_ids.includes(bookId);
              return (
                <li key={list.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                    disabled={alreadyIn}
                    onClick={() => void addBookToList(list.id, bookId)}
                  >
                    <span className="truncate">{list.name}</span>
                    {alreadyIn && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={handleCreate} className="flex gap-1.5">
          <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder={t("library.readingLists.nameLabel")} className="h-8 text-sm" />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" aria-label={t("library.readingLists.create")}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
