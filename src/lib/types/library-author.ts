/**
 * Library — Author types (Phase 1 architecture prep)
 * Planned table: library_authors.
 */

export interface LibraryAuthorRow {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  book_count: number;
  follower_count: number;
  birth_year: number | null;
  nationality: string | null;
}
