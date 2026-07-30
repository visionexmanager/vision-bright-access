export type CreatorKind = "creator" | "publisher" | "developer" | "teacher";
export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export interface Creator {
  user_id: string;
  display_name: string;
  kind: CreatorKind;
  bio: string | null;
  avatar: string;
  verified: boolean;
  verification_status: VerificationStatus;
  verification_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketCategory {
  slug: string;
  title: string;
  emoji: string;
  order_index: number;
  status: "published" | "draft";
}

export type ProductType =
  | "course" | "book" | "game" | "template" | "music" | "video" | "worksheet"
  | "model3d" | "prompt" | "bundle" | "story" | "activity" | "pdf" | "epub"
  | "audio" | "character" | "puzzle" | "sfx";

export type ProductLevel = "beginner" | "intermediate" | "advanced" | "all";
export type ProductStatus = "draft" | "pending" | "published" | "rejected";
export type LicenseKind = "standard" | "extended" | "personal" | "cc";

export interface Product {
  id: string;
  creator_id: string;
  type: ProductType;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  thumbnail_url: string | null;
  category: string;
  age_min: number;
  age_max: number;
  language: string;
  level: ProductLevel;
  price_coins: number;
  is_free: boolean;
  license: LicenseKind;
  file_url: string | null;
  preview_url: string | null;
  content: Record<string, unknown>;
  status: ProductStatus;
  downloads: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface MarketOrder {
  id: string;
  user_id: string;
  product_id: string;
  price_coins: number;
  status: "completed" | "refunded";
  created_at: string;
}

export interface MarketReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  likes: number;
  status: "visible" | "hidden";
  created_at: string;
  updated_at: string;
}

export interface ModerationRecord {
  product_id: string;
  auto_status: "pending" | "passed" | "flagged";
  auto_flags: string[];
  human_status: "pending" | "approved" | "rejected";
  reviewer_id: string | null;
  notes: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface CreatorStats {
  published: number;
  pending: number;
  draft: number;
  rejected: number;
  downloads: number;
  earnings: number;
  avg_rating: number;
}

/** Advanced search facets (all optional). */
export interface ProductSearch {
  q?: string;
  type?: ProductType;
  category?: string;
  language?: string;
  level?: ProductLevel;
  ageMin?: number;
  ageMax?: number;
  maxPrice?: number;
  freeOnly?: boolean;
  minRating?: number;
  sort?: "newest" | "popular" | "rating" | "price_low" | "price_high";
}

export interface ProductInput {
  type: ProductType;
  title: string;
  slug: string;
  description?: string;
  emoji?: string;
  category?: string;
  age_min?: number;
  age_max?: number;
  language?: string;
  level?: ProductLevel;
  price_coins?: number;
  license?: LicenseKind;
  file_url?: string;
  preview_url?: string;
}
