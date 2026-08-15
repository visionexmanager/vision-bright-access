import { createContext, useContext } from "react";

// The provider lives in ./CartProvider. Keeping the context and its hook in a
// module that exports no components is what lets both halves hot-reload.

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  points: number;
  image: string;
  rating: number;
  inStock: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  totalPoints: number;
}

export const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  totalPrice: 0,
  totalPoints: 0,
});

export const useCart = () => useContext(CartContext);
