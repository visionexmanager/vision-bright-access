/**
 * Where to order from the world's online stores, as a directory.
 *
 * The same idea as `vendors.ts`: the name of a store, the country it is based
 * in and the address of its own front door. No product, price, review or image
 * is copied, and nothing is said about how a store ships, returns or treats
 * used items: none of that has been checked here, so the directory does not
 * claim it. Whether a store has new or used stock is for the person (or the
 * team ordering for them) to read at the store itself.
 *
 * Add a row only for a store whose own address you have opened.
 */

import { GLOBAL_STORES } from "../../../supabase/functions/_shared/deskDirectory.ts";

export interface Store {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 of the company's home country, shown through Intl.DisplayNames. */
  country: string;
  /** The store's own front door. https only. */
  url: string;
}

export const STORES: readonly Store[] = GLOBAL_STORES;

export function storeById(id: string): Store | undefined {
  return STORES.find((store) => store.id === id);
}
