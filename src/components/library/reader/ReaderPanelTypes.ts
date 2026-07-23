/** Which side panel (if any) is currently open in the reader shell. Shared
 *  between the toolbars and ReaderShell so they agree on the same set of
 *  panel keys. */
export type ReaderPanelKey =
  | "toc" | "bookmarks" | "notes" | "highlights" | "search" | "settings"
  | "ai" | "readAloud" | "info" | "offline" | "help"
  | "coach" | "accessibility";
