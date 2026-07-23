import { useState, useCallback, useMemo } from "react";
import {
  MessageSquare, Send, Store, ShoppingCart, X, Plus, ArrowLeft,
  Coins, Crown, Package, Settings, Trash2, ImagePlus, CheckCircle2,
  BarChart3, Bell, Flag, Heart, Mail, ShieldCheck, Star, Truck,
  CreditCard, DollarSign, Search, Save, Smartphone,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { useTrial } from "@/hooks/useTrial";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useAmbientSound } from "@/hooks/useAmbientSound";
import { WatchAdButton } from "@/components/WatchAdButton";
import { aiService } from "@/services/ai/aiService";
import { parseSSEResponse } from "@/lib/api/useSSEStream";
import { AITaskPanel } from "@/components/AITaskPanel";
import { SmartSearch } from "@/components/SmartSearch";
import { speakText } from "@/lib/audio/speech";

// ── Types ──────────────────────────────────────────────────────────────────
type Tier = "kiosk" | "boutique" | "store" | "flagship";
type View = "street" | "inside" | "chat" | "create" | "manage";
type ProductType = "physical" | "digital" | "service";

interface Shop {
  id: string;
  owner_id: string;
  name: string;
  tier: Tier;
  description: string | null;
  theme_color: string;
  bg_image: string | null;
  sign_style: string;
  country: string | null;
  is_active: boolean;
  email_notifications?: boolean | null;
  whatsapp_notifications?: boolean | null;
  whatsapp_number?: string | null;
  vacation_mode?: boolean | null;
  trust_score?: number | null;
  response_rate?: number | null;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  order_notifications?: boolean | null;
  message_notifications?: boolean | null;
  review_notifications?: boolean | null;
  low_stock_notifications?: boolean | null;
}

interface BazaarProduct {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  shelf_position: string | null;
  in_stock: boolean;
  category?: string | null;
  product_type?: ProductType | null;
  alt_text?: string | null;
  stock_qty?: number | null;
  delivery_time?: string | null;
  shipping_from?: string | null;
  shipping_cost?: number | null;
  return_policy?: string | null;
  is_accessible?: boolean | null;
  is_featured?: boolean | null;
  views_count?: number | null;
  cart_count?: number | null;
  sold_count?: number | null;
  price_vx?: number | null;
  price_usd?: number | null;
  accepts_vx?: boolean | null;
  accepts_cash?: boolean | null;
}

interface BazaarOrder {
  id: string;
  buyer_id: string;
  shop_id: string;
  payment_method: "vx" | "cash";
  status: string;
  total_vx: number | null;
  total_usd: number | null;
  created_at: string;
}

interface ChatMessage {
  text: string;
  sender: "user" | "seller";
}

interface BazaarReview {
  id: string;
  product_id: string;
  shop_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  verified_purchase: boolean | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<Tier, { label: string; maxProducts: number; setupCost: number; rentCost: number; color: string }> = {
  kiosk:    { label: "Kiosk",    maxProducts: 10,       setupCost: 5_000,   rentCost: 1_000,  color: "#6b7280" },
  boutique: { label: "Boutique", maxProducts: 50,       setupCost: 20_000,  rentCost: 3_000,  color: "#8b5cf6" },
  store:    { label: "Store",    maxProducts: 200,      setupCost: 60_000,  rentCost: 8_000,  color: "#3b82f6" },
  flagship: { label: "Flagship", maxProducts: Infinity, setupCost: 150_000, rentCost: 20_000, color: "#f59e0b" },
};

const TIER_ICONS: Record<Tier, React.ElementType> = {
  kiosk:    Store,
  boutique: ShoppingCart,
  store:    Package,
  flagship: Crown,
};

const SIGN_STYLES: Record<string, string> = {
  neon:   "shadow-[0_0_18px_rgba(245,158,11,0.7)] border-amber-400 text-amber-300",
  royal:  "shadow-[0_0_18px_rgba(139,92,246,0.7)] border-purple-400 text-purple-200",
  cyber:  "shadow-[0_0_18px_rgba(59,130,246,0.7)] border-blue-400 text-blue-200",
  simple: "border-white/50 text-white",
};

const SHELF_POSITIONS = ["Front Window", "Center Shelf", "Back Wall", "Display Stand", "Clearance Rack"];
const SHELF_KEY: Record<string, string> = {
  "Front Window": "frontWindow",
  "Center Shelf": "centerShelf",
  "Back Wall": "backWall",
  "Display Stand": "displayStand",
  "Clearance Rack": "clearanceRack",
};
const DEFAULT_BG = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200";

const PRODUCT_CATEGORIES = [
  { key: "assistive", label: "Assistive Tech" },
  { key: "digital", label: "Digital Tools" },
  { key: "education", label: "Education" },
  { key: "services", label: "Services" },
  { key: "electronics", label: "Electronics" },
  { key: "home", label: "Home" },
  { key: "fashion", label: "Fashion" },
  { key: "health", label: "Health & Wellness" },
  { key: "creative", label: "Creative Assets" },
  { key: "handmade", label: "Handmade" },
  { key: "business", label: "Business Services" },
];

const PRODUCT_TYPES: { key: ProductType; label: string }[] = [
  { key: "physical", label: "Physical" },
  { key: "digital", label: "Digital" },
  { key: "service", label: "Service" },
];

const DISPUTE_REASONS = [
  "Not received",
  "Different from description",
  "Seller not responding",
  "Technical delivery issue",
  "Fraud concern",
];

const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "SA", name: "Saudi Arabia",     flag: "🇸🇦" },
  { code: "AE", name: "UAE",              flag: "🇦🇪" },
  { code: "KW", name: "Kuwait",           flag: "🇰🇼" },
  { code: "QA", name: "Qatar",            flag: "🇶🇦" },
  { code: "BH", name: "Bahrain",          flag: "🇧🇭" },
  { code: "OM", name: "Oman",             flag: "🇴🇲" },
  { code: "EG", name: "Egypt",            flag: "🇪🇬" },
  { code: "JO", name: "Jordan",           flag: "🇯🇴" },
  { code: "LB", name: "Lebanon",          flag: "🇱🇧" },
  { code: "IQ", name: "Iraq",             flag: "🇮🇶" },
  { code: "SY", name: "Syria",            flag: "🇸🇾" },
  { code: "YE", name: "Yemen",            flag: "🇾🇪" },
  { code: "MA", name: "Morocco",          flag: "🇲🇦" },
  { code: "TN", name: "Tunisia",          flag: "🇹🇳" },
  { code: "DZ", name: "Algeria",          flag: "🇩🇿" },
  { code: "LY", name: "Libya",            flag: "🇱🇾" },
  { code: "SD", name: "Sudan",            flag: "🇸🇩" },
  { code: "US", name: "United States",    flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom",   flag: "🇬🇧" },
  { code: "DE", name: "Germany",          flag: "🇩🇪" },
  { code: "FR", name: "France",           flag: "🇫🇷" },
  { code: "ES", name: "Spain",            flag: "🇪🇸" },
  { code: "IT", name: "Italy",            flag: "🇮🇹" },
  { code: "TR", name: "Turkey",           flag: "🇹🇷" },
  { code: "PK", name: "Pakistan",         flag: "🇵🇰" },
  { code: "IN", name: "India",            flag: "🇮🇳" },
  { code: "PH", name: "Philippines",      flag: "🇵🇭" },
  { code: "NG", name: "Nigeria",          flag: "🇳🇬" },
  { code: "ZA", name: "South Africa",     flag: "🇿🇦" },
  { code: "BR", name: "Brazil",           flag: "🇧🇷" },
  { code: "CA", name: "Canada",           flag: "🇨🇦" },
  { code: "AU", name: "Australia",        flag: "🇦🇺" },
  { code: "JP", name: "Japan",            flag: "🇯🇵" },
  { code: "CN", name: "China",            flag: "🇨🇳" },
  { code: "KR", name: "South Korea",      flag: "🇰🇷" },
  { code: "RU", name: "Russia",           flag: "🇷🇺" },
  { code: "NL", name: "Netherlands",      flag: "🇳🇱" },
  { code: "SE", name: "Sweden",           flag: "🇸🇪" },
  { code: "PL", name: "Poland",           flag: "🇵🇱" },
  { code: "MX", name: "Mexico",           flag: "🇲🇽" },
];

function getCountry(code: string | null) {
  return COUNTRIES.find(c => c.code === code) ?? null;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function VXBazaar() {
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const { isOnTrial } = useTrial();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const { playSound } = useSound();
  // Generated Supabase types will include these tables after the production migration is applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  useAmbientSound("marketplace");

  const [view, setView] = useState<View>("street");
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [shopSearch, setShopSearch] = useState("");
  const [shopTierFilter, setShopTierFilter] = useState<"all" | Tier>("all");
  const [shopCountryFilter, setShopCountryFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState<"all" | ProductType>("all");
  const [selectedProduct, setSelectedProduct] = useState<BazaarProduct | null>(null);
  const [bazaarCart, setBazaarCart] = useState<Record<string, number>>({});
  const [checkoutLoading, setCheckoutLoading] = useState<"vx" | "cash" | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [disputeForm, setDisputeForm] = useState({ product_id: "", reason: DISPUTE_REASONS[0], description: "" });
  const [createForm, setCreateForm] = useState({
    name: "", tier: "kiosk" as Tier, description: "",
    theme_color: "#f59e0b", sign_style: "neon", country: "",
    email_notifications: true, whatsapp_notifications: false, whatsapp_number: "",
  });
  const [productForm, setProductForm] = useState({
    name: "", description: "", price_vx: "", price_usd: "", image: "", shelf_position: "Front Window",
    category: "assistive", product_type: "physical" as ProductType, alt_text: "",
    stock_qty: "1", delivery_time: "", shipping_from: "", shipping_cost: "0",
    return_policy: "", is_accessible: true, accepts_vx: true, accepts_cash: false,
  });
  const tierLabel = (tier: Tier) => t(`bazaar.tier.${tier}`);
  const shelfLabel = (position: string | null) => position ? t(`bazaar.shelf.${SHELF_KEY[position] ?? "frontWindow"}`) : "";
  const signStyleLabel = (style: string) => t(`bazaar.sign.${style}`);
  const countryLabel = (code: string | null) => {
    const country = getCountry(code);
    return country ? `${country.flag} ${t(`vep.country.${country.code}`)}` : "";
  };
  const applyListingCopilotResult = (value: string) => {
    const clean = value
      .replace(/^```(?:\w+)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const lower = clean.toLowerCase();
    if (/(alt text|image description|screen reader)/.test(lower)) {
      setProductForm((form) => ({ ...form, alt_text: clean.replace(/^alt text:\s*/i, "").slice(0, 180) }));
      return;
    }
    if (/(return policy|refund|returns)/.test(lower)) {
      setProductForm((form) => ({ ...form, return_policy: clean.replace(/^return policy:\s*/i, "").slice(0, 300) }));
      return;
    }
    setProductForm((form) => ({ ...form, description: clean.replace(/^description:\s*/i, "").slice(0, 300) }));
  };

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ["bazaar-shops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazaar_shops").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Shop[];
    },
  });

  const { data: activeProducts = [], refetch: refetchProducts } = useQuery({
    queryKey: ["bazaar-products", activeShop?.id],
    enabled: !!activeShop,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazaar_products").select("*").eq("shop_id", activeShop!.id).order("created_at");
      if (error) throw error;
      return data as BazaarProduct[];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["bazaar-reviews", activeShop?.id],
    enabled: !!activeShop,
    queryFn: async () => {
      const { data, error } = await db.from("bazaar_reviews").select("*").eq("shop_id", activeShop!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as BazaarReview[];
    },
  });

  const { data: sellerOrders = [] } = useQuery({
    queryKey: ["bazaar-seller-orders", activeShop?.id],
    enabled: !!activeShop && activeShop.owner_id === user?.id,
    queryFn: async () => {
      const { data, error } = await db.from("bazaar_orders").select("*").eq("shop_id", activeShop!.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as BazaarOrder[];
    },
  });

  const myShop = shops.find(s => s.owner_id === user?.id);
  const isOwner = activeShop?.owner_id === user?.id;

  // ── Create shop ────────────────────────────────────────────────────────
  const createShopMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not_authenticated");

      const { error } = await db.rpc("create_bazaar_shop", {
        _name: createForm.name.trim(),
        _tier: createForm.tier,
        _description: createForm.description.trim() || null,
        _theme_color: createForm.theme_color,
        _sign_style: createForm.sign_style,
        _country: createForm.country || null,
        _email_notifications: createForm.email_notifications,
        _whatsapp_notifications: createForm.whatsapp_notifications,
        _whatsapp_number: createForm.whatsapp_number.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bazaar-shops"] });
      queryClient.invalidateQueries({ queryKey: ["points-total", user?.id] });
      toast({ title: t("bazaar.shopOpened") });
      playSound("success");
      setView("street");
    },
    onError: (e: Error) => {
      if (e.message === "insufficient_points")
        toast({ title: t("bazaar.notEnoughVX"), variant: "destructive" });
      else if (e.message === "not_authenticated")
        toast({ title: t("bazaar.loginToOpen"), variant: "destructive" });
      else
        toast({ title: t("bazaar.createFailed"), description: e.message, variant: "destructive" });
    },
  });

  // ── Add product ────────────────────────────────────────────────────────
  const addProductMutation = useMutation({
    mutationFn: async () => {
      if (!activeShop) throw new Error("no_shop");
      const tierCfg = TIER_CONFIG[activeShop.tier];
      if (activeProducts.length >= tierCfg.maxProducts)
        throw new Error("max_products");

      const acceptsVx = productForm.accepts_vx && !!productForm.price_vx;
      const acceptsCash = productForm.accepts_cash && !!productForm.price_usd;
      if (!acceptsVx && !acceptsCash) throw new Error("payment_required");

      const moderationText = [
        productForm.name,
        productForm.description,
        productForm.alt_text,
        productForm.return_policy,
      ].filter(Boolean).join("\n");
      if (moderationText.trim()) {
        try {
          const moderation = await aiService.moderate(moderationText);
          if (moderation.flagged) throw new Error("content_flagged");
        } catch (error) {
          if (error instanceof Error && error.message === "content_flagged") throw error;
          console.warn("Product moderation unavailable:", error);
        }
      }

      const { error } = await db.from("bazaar_products").insert({
        shop_id: activeShop.id,
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        price: acceptsVx ? parseInt(productForm.price_vx, 10) : parseFloat(productForm.price_usd),
        price_vx: acceptsVx ? parseInt(productForm.price_vx, 10) : null,
        price_usd: acceptsCash ? parseFloat(productForm.price_usd) : null,
        accepts_vx: acceptsVx,
        accepts_cash: acceptsCash,
        image: productForm.image.trim() || null,
        shelf_position: productForm.shelf_position,
        category: productForm.category,
        product_type: productForm.product_type,
        alt_text: productForm.alt_text.trim() || null,
        stock_qty: Math.max(0, parseInt(productForm.stock_qty, 10) || 0),
        delivery_time: productForm.delivery_time.trim() || null,
        shipping_from: productForm.shipping_from.trim() || null,
        shipping_cost: Math.max(0, parseFloat(productForm.shipping_cost) || 0),
        return_policy: productForm.return_policy.trim() || null,
        is_accessible: productForm.is_accessible,
        in_stock: (parseInt(productForm.stock_qty, 10) || 0) > 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchProducts();
      setProductForm({
        name: "", description: "", price_vx: "", price_usd: "", image: "", shelf_position: "Front Window",
        category: "assistive", product_type: "physical", alt_text: "", stock_qty: "1",
        delivery_time: "", shipping_from: "", shipping_cost: "0", return_policy: "",
        is_accessible: true, accepts_vx: true, accepts_cash: false,
      });
      toast({ title: t("bazaar.productAdded") });
      playSound("click");
    },
    onError: (e: Error) => {
      if (e.message === "max_products")
        toast({ title: t("bazaar.maxProductsReached"), variant: "destructive" });
      else if (e.message === "payment_required")
        toast({ title: t("bazaar.choosePaymentPrice"), variant: "destructive" });
      else if (e.message === "content_flagged")
        toast({ title: t("bazaar.contentFlagged"), variant: "destructive" });
      else
        toast({ title: t("bazaar.addProductFailed"), variant: "destructive" });
    },
  });

  // ── Delete product ─────────────────────────────────────────────────────
  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("bazaar_products").delete().eq("id", id);
    if (error) {
      toast({ title: t("bazaar.addProductFailed"), description: error.message, variant: "destructive" });
      return;
    }
    await refetchProducts();
    toast({ title: t("bazaar.productRemoved") });
  };

  const filteredShops = useMemo(() => shops.filter(shop => {
    const query = shopSearch.trim().toLowerCase();
    return (!query || shop.name.toLowerCase().includes(query) || shop.description?.toLowerCase().includes(query))
      && (shopTierFilter === "all" || shop.tier === shopTierFilter)
      && (shopCountryFilter === "all" || shop.country === shopCountryFilter);
  }), [shops, shopSearch, shopTierFilter, shopCountryFilter]);

  const filteredProducts = useMemo(() => activeProducts.filter(product => {
    const query = productSearch.trim().toLowerCase();
    return product.in_stock
      && (!query || product.name.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query))
      && (productCategoryFilter === "all" || product.category === productCategoryFilter)
      && (productTypeFilter === "all" || product.product_type === productTypeFilter);
  }), [activeProducts, productSearch, productCategoryFilter, productTypeFilter]);

  const cartItems = useMemo(() => activeProducts
    .filter(product => bazaarCart[product.id])
    .map(product => ({ product, quantity: bazaarCart[product.id] })), [activeProducts, bazaarCart]);
  const cartVxTotal = cartItems.reduce((sum, item) => sum + Number(item.product.price_vx || 0) * item.quantity, 0);
  const cartCashTotal = cartItems.reduce((sum, item) => sum + Number(item.product.price_usd || 0) * item.quantity, 0);
  const cartSupportsVx = cartItems.length > 0 && cartItems.every(item => item.product.accepts_vx && item.product.price_vx);
  const cartSupportsCash = cartItems.length > 0 && cartItems.every(item => item.product.accepts_cash && item.product.price_usd);

  const addBazaarItem = async (product: BazaarProduct) => {
    if (!user) {
      toast({ title: "Sign in to shop", variant: "destructive" });
      return;
    }
    setBazaarCart(current => ({
      ...current,
      [product.id]: Math.min(Number(product.stock_qty || 1), (current[product.id] || 0) + 1),
    }));
    await db.from("bazaar_product_interactions").insert({
      product_id: product.id, shop_id: product.shop_id, actor_id: user.id, interaction_type: "add_to_cart",
    });
    void supabase.functions.invoke("bazaar-notify-seller", {
      body: { shopId: product.shop_id, productId: product.id, eventType: "add_to_cart" },
    });
    playSound("points");
  };

  const checkoutVX = async () => {
    if (!activeShop || !user || !cartSupportsVx) return;
    setCheckoutLoading("vx");
    const { data, error } = await db.rpc("create_bazaar_vx_order", {
      _shop_id: activeShop.id,
      _items: cartItems.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
      _buyer_note: null,
    });
    setCheckoutLoading(null);
    if (error) {
      toast({ title: error.message || "VX checkout failed", variant: "destructive" });
      return;
    }
    setBazaarCart({});
    await refetchProducts();
    queryClient.invalidateQueries({ queryKey: ["points-total", user.id] });
    void supabase.functions.invoke("bazaar-notify-seller", {
      body: { shopId: activeShop.id, eventType: "order_paid", message: `VX order ${String(data).slice(0, 8)} has been paid.` },
    });
    toast({ title: `Order ${String(data).slice(0, 8)} paid with VX` });
    playSound("success");
  };

  const checkoutCash = async () => {
    if (!activeShop || !user || !cartSupportsCash) return;
    setCheckoutLoading("cash");
    const { data, error } = await supabase.functions.invoke("bazaar-checkout", {
      body: {
        shopId: activeShop.id,
        items: cartItems.map(item => ({ productId: item.product.id, quantity: item.quantity })),
        returnUrl: `${window.location.origin}${window.location.pathname}`,
      },
    });
    setCheckoutLoading(null);
    if (error || !data?.checkoutUrl) {
      toast({ title: data?.error || error?.message || "Cash checkout is not configured", variant: "destructive" });
      return;
    }
    window.location.assign(data.checkoutUrl);
  };

  const toggleWishlist = async (product: BazaarProduct) => {
    if (!user) return toast({ title: "Sign in to save products", variant: "destructive" });
    const { error } = await db.from("bazaar_wishlists").upsert({ user_id: user.id, product_id: product.id });
    if (error) return toast({ title: error.message, variant: "destructive" });
    await db.from("bazaar_product_interactions").insert({
      product_id: product.id, shop_id: product.shop_id, actor_id: user.id, interaction_type: "wishlist",
    });
    void supabase.functions.invoke("bazaar-notify-seller", {
      body: { shopId: product.shop_id, productId: product.id, eventType: "wishlist" },
    });
    toast({ title: "Saved to wishlist" });
  };

  const submitReview = async () => {
    if (!user || !selectedProduct || !activeShop) return;
    const { error } = await db.from("bazaar_reviews").upsert({
      product_id: selectedProduct.id,
      shop_id: activeShop.id,
      reviewer_id: user.id,
      rating: reviewForm.rating,
      comment: reviewForm.comment.trim() || null,
    }, { onConflict: "product_id,reviewer_id" });
    if (error) return toast({ title: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["bazaar-reviews", activeShop.id] });
    void supabase.functions.invoke("bazaar-notify-seller", {
      body: { shopId: activeShop.id, productId: selectedProduct.id, eventType: "review", message: reviewForm.comment },
    });
    setReviewForm({ rating: 5, comment: "" });
    toast({ title: "Review published" });
  };

  const submitDispute = async () => {
    if (!user || !selectedProduct || !activeShop || !disputeForm.description.trim()) return;
    const { error } = await db.from("bazaar_disputes").insert({
      product_id: selectedProduct.id,
      shop_id: activeShop.id,
      buyer_id: user.id,
      reason: disputeForm.reason,
      description: disputeForm.description.trim(),
    });
    if (error) return toast({ title: error.message, variant: "destructive" });
    void supabase.functions.invoke("bazaar-notify-seller", {
      body: {
        shopId: activeShop.id,
        productId: selectedProduct.id,
        eventType: "dispute",
        message: `${disputeForm.reason}: ${disputeForm.description}`,
      },
    });
    setDisputeForm({ product_id: "", reason: DISPUTE_REASONS[0], description: "" });
    toast({ title: "Support case opened" });
  };

  const saveShopSettings = async () => {
    if (!activeShop || !isOwner) return;
    setSettingsSaving(true);
    const { error } = await db.from("bazaar_shops").update({
      email_notifications: activeShop.email_notifications !== false,
      whatsapp_notifications: !!activeShop.whatsapp_notifications,
      whatsapp_number: activeShop.whatsapp_number?.trim() || null,
      order_notifications: activeShop.order_notifications !== false,
      message_notifications: activeShop.message_notifications !== false,
      review_notifications: activeShop.review_notifications !== false,
      low_stock_notifications: activeShop.low_stock_notifications !== false,
    }).eq("id", activeShop.id);
    setSettingsSaving(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["bazaar-shops"] });
    toast({ title: "Notification settings saved" });
  };

  const connectStripe = async () => {
    if (!activeShop) return;
    const { data, error } = await supabase.functions.invoke("bazaar-stripe-connect", {
      body: { shopId: activeShop.id, returnUrl: `${window.location.origin}${window.location.pathname}` },
    });
    if (data?.complete) {
      setActiveShop({ ...activeShop, stripe_onboarding_complete: true });
      queryClient.invalidateQueries({ queryKey: ["bazaar-shops"] });
      return toast({ title: "Stripe payouts are connected" });
    }
    if (error || !data?.url) return toast({ title: data?.error || "Stripe Connect is not configured", variant: "destructive" });
    window.location.assign(data.url);
  };

  // ── Enter shop ────────────────────────────────────────────────────────
  const enterShop = useCallback((shop: Shop) => {
    setActiveShop(shop);
    setMessages([{ text: t("bazaar.chatWelcome").replace("{shop}", shop.name), sender: "seller" }]);
    setView("inside");
    playSound("open");
    speakText(t("bazaar.speechWelcome").replace("{shop}", shop.name), lang, { rate: 0.9 });
  }, [lang, playSound, t]);

  // ── AI Chat ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    playSound("send");
    setMessages(prev => [...prev, { text: userMsg, sender: "user" }]);
    setChatLoading(true);
    if (activeShop && user && activeShop.owner_id !== user.id) {
      void supabase.functions.invoke("bazaar-notify-seller", {
        body: { shopId: activeShop.id, eventType: "message", message: userMsg },
      });
    }

    try {
      const inStockProducts = activeProducts.filter(p => p.in_stock);
      const context = `You are a helpful seller at "${activeShop?.name}", a shop in VXBazaar. Products: ${
        inStockProducts.map(p => {
          const vxPart = p.accepts_vx && p.price_vx ? `${p.price_vx} VX` : "";
          const usdPart = p.accepts_cash && p.price_usd ? `$${p.price_usd}` : "";
          const priceStr = [vxPart, usdPart].filter(Boolean).join(" / ") || `${p.price} VX`;
          return `${p.name} (${priceStr})`;
        }).join(", ") || "none listed yet"
      }. Be brief and helpful.`;

      const response = await aiService.streamChat([
        { role: "system",  content: context },
        { role: "user",    content: userMsg },
      ]);

      let reply = t("bazaar.chatUnavailable");
      if (response.ok) {
        const full = await parseSSEResponse(response, () => {});
        if (full) reply = full;
      }
      setMessages(prev => [...prev, { text: reply, sender: "seller" }]);
    } catch {
      setMessages(prev => [...prev, { text: t("bazaar.chatConnectionError"), sender: "seller" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const activeTierCfg = activeShop ? TIER_CONFIG[activeShop.tier] : null;
  const signClass = activeShop ? (SIGN_STYLES[activeShop.sign_style] ?? SIGN_STYLES.neon) : "";

  return (
    <Layout>
      <div className="min-h-screen overflow-hidden" style={{ background: "linear-gradient(180deg, #0d0a1a 0%, #1a0d2e 40%, #0f1520 100%)" }}>
        <>

          {/* ════════════════════════════════════════════════════════════
              STREET VIEW
          ════════════════════════════════════════════════════════════ */}
          {view === "street" && (
            <div className="animate-in fade-in duration-300">

              {/* Sky + stars */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {[...Array(40)].map((_, i) => (
                  <div key={i} className="absolute rounded-full bg-white/70"
                    style={{
                      width: Math.random() * 2 + 1 + "px",
                      height: Math.random() * 2 + 1 + "px",
                      top: Math.random() * 45 + "%",
                      left: Math.random() * 100 + "%",
                      opacity: Math.random() * 0.6 + 0.2,
                      animation: `pulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </div>

              {/* Earn VX Banner */}
              <div className="relative z-10 px-4 pt-6">
                <WatchAdButton variant="banner" className="mb-6" />
              </div>

              {/* Header */}
              <div className="relative z-10 px-4 pt-10 pb-4 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs text-amber-400 mb-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> {t("bazaar.openForBusiness")}
                </div>
                <h1 className="text-5xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600 md:text-6xl"
                  style={{ textShadow: "0 0 40px rgba(245,158,11,0.4)" }}>
                  VXBazaar
                </h1>
                <p className="mt-1 text-stone-400">{t("bazaar.subtitle")}</p>

                {user && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-bold text-amber-400">
                      <Coins className="h-4 w-4" /> {totalPoints.toLocaleString()} VX
                    </span>
                    {myShop ? (
                      <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => enterShop(myShop)}>
                        <Store className="me-1.5 h-4 w-4" /> {t("bazaar.myShop")}
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 font-bold" onClick={() => setView("create")}>
                        <Plus className="me-1.5 h-4 w-4" /> {t("bazaar.openAShop")}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="relative z-10 mx-auto mb-4 max-w-4xl px-4">
                <SmartSearch source="products" />
              </div>

              <div className="relative z-10 mx-auto mb-5 grid max-w-4xl gap-2 px-4 md:grid-cols-[1fr_160px_180px]">
                <div className="relative">
                  <Search className="absolute start-3 top-2.5 h-4 w-4 text-stone-500" />
                  <Input value={shopSearch} onChange={event => setShopSearch(event.target.value)}
                    placeholder="Search shops" aria-label="Search shops" className="border-white/15 bg-black/30 ps-9 text-white" />
                </div>
                <select value={shopTierFilter} onChange={event => setShopTierFilter(event.target.value as "all" | Tier)}
                  className="rounded-md border border-white/15 bg-stone-950 px-3 text-sm text-white">
                  <option value="all">All shop sizes</option>
                  {(Object.keys(TIER_CONFIG) as Tier[]).map(tier => <option key={tier} value={tier}>{tierLabel(tier)}</option>)}
                </select>
                <select value={shopCountryFilter} onChange={event => setShopCountryFilter(event.target.value)}
                  className="rounded-md border border-white/15 bg-stone-950 px-3 text-sm text-white">
                  <option value="all">All countries</option>
                  {COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
                </select>
              </div>

              {/* Street lanterns (decorative) */}
              <div className="relative z-10 flex justify-around px-8 mb-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center opacity-60">
                    <div className="h-16 w-0.5 bg-gradient-to-b from-transparent to-stone-600" />
                    <div className="h-4 w-4 rounded-full bg-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                  </div>
                ))}
              </div>

              {/* Shops street */}
              {shopsLoading ? (
                  <div className="flex justify-center py-20 text-stone-500">{t("bazaar.loadingShops")}</div>
              ) : filteredShops.length === 0 ? (
                <div className="relative z-10 flex flex-col items-center gap-4 py-20 text-center text-stone-500">
                  <Store className="h-16 w-16 opacity-20" />
                  <p className="text-lg text-stone-400">{t("bazaar.noShops")}</p>
                  {user && (
                    <Button className="bg-amber-500 text-black hover:bg-amber-400 font-bold" onClick={() => setView("create")}>
                      <Plus className="me-2 h-4 w-4" /> {t("bazaar.openAShop")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="relative z-10">
                  {/* Building tops strip */}
                  <div className="flex gap-8 overflow-x-hidden px-8">
                    {filteredShops.map(shop => {
                      const cfg = TIER_CONFIG[shop.tier];
                      const TierIconComp = TIER_ICONS[shop.tier];
                      return (
                        <div key={shop.id + "-top"} className="min-w-[300px] md:min-w-[360px] flex-shrink-0">
                          {/* Rooftop decoration */}
                          <div className="flex items-end justify-center h-14 gap-1">
                            {shop.tier === "flagship" && (
                              <>
                                <div className="h-14 w-3 rounded-t-sm" style={{ backgroundColor: shop.theme_color + "80" }} />
                                <div className="h-10 w-5 rounded-t-sm" style={{ backgroundColor: shop.theme_color + "60" }} />
                                <div className="h-12 w-4 rounded-t-sm" style={{ backgroundColor: shop.theme_color + "70" }} />
                              </>
                            )}
                            {shop.tier === "store" && (
                              <>
                                <div className="h-8 w-4 rounded-t-sm" style={{ backgroundColor: shop.theme_color + "60" }} />
                                <div className="h-12 w-6 rounded-t-sm" style={{ backgroundColor: shop.theme_color + "80" }} />
                                <div className="h-8 w-4 rounded-t-sm" style={{ backgroundColor: shop.theme_color + "60" }} />
                              </>
                            )}
                            {(shop.tier === "boutique" || shop.tier === "kiosk") && (
                              <div className="h-8 w-16 rounded-t-full" style={{ backgroundColor: shop.theme_color + "50" }} />
                            )}
                          </div>
                          {/* Tier label on building */}
                          <div className="flex justify-end pr-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1" style={{ color: cfg.color, backgroundColor: cfg.color + "22" }}>
                              <TierIconComp className="h-3 w-3" aria-hidden="true" />
                              {tierLabel(shop.tier)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Shop facades row */}
                  <div className="flex gap-8 overflow-x-auto pb-0 px-8 snap-x snap-mandatory scrollbar-thin scrollbar-track-stone-900 scrollbar-thumb-amber-600">
                    {filteredShops.map(shop => {
                      const sign = SIGN_STYLES[shop.sign_style] ?? SIGN_STYLES.neon;
                      return (
                        <div
                          className="relative min-w-[300px] h-[400px] snap-center flex-shrink-0 cursor-pointer md:min-w-[360px] transition-transform hover:-translate-y-1.5 hover:scale-[1.01]"
                          onClick={() => enterShop(shop)}
                          role="button"
                          aria-label={t("bazaar.enterShop").replace("{shop}", shop.name)}
                          tabIndex={0}
                          onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), enterShop(shop))}
                        >
                          {/* Shop building */}
                          <div
                            className="h-full w-full border-2 border-t-0 overflow-hidden"
                            style={{ borderColor: shop.theme_color + "66" }}
                          >
                            {/* Window display */}
                            <div className="relative h-48 overflow-hidden">
                              <img
                                src={shop.bg_image ?? DEFAULT_BG}
                                className="h-full w-full object-cover opacity-60"
                                alt={shop.name}
                              />
                              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-950/80" />
                              {/* Window frame overlay */}
                              <div className="absolute inset-2 border border-white/10 pointer-events-none" />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-full bg-white/5 pointer-events-none" />
                              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 pointer-events-none" />
                            </div>

                            {/* Facade bottom */}
                            <div className="relative bg-stone-900 h-[calc(100%-12rem)] flex flex-col items-center justify-between px-4 pt-3 pb-4"
                              style={{ background: `linear-gradient(180deg, #1c1917 0%, ${shop.theme_color}11 100%)` }}>
                              {/* Sign */}
                              <div className={`w-full text-center bg-black/80 px-3 py-2 border rounded ${sign}`}>
                                <span className="font-black uppercase tracking-tight">{shop.name}</span>
                                {shop.description && (
                                  <p className="mt-0.5 text-[10px] opacity-70 line-clamp-1">{shop.description}</p>
                                )}
                                {shop.country && (() => {
                                  const c = getCountry(shop.country);
                                  return c ? (
                                    <p className="mt-1 text-[10px] opacity-60">{countryLabel(shop.country)}</p>
                                  ) : null;
                                })()}
                              </div>

                              {/* Door */}
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex gap-3">
                                  <div className="h-14 w-6 rounded-t-full border border-white/20 bg-black/40" />
                                  <div className="h-14 w-6 rounded-t-full border border-white/20 bg-black/40" />
                                </div>
                                <button
                                  className="rounded-full px-7 py-2 text-sm font-bold text-black transition-all"
                                  style={{ backgroundColor: shop.theme_color }}
                                  onClick={e => { e.stopPropagation(); enterShop(shop); }}
                                >
                                  {t("bazaar.stepInside")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sidewalk */}
                  <div className="relative h-10 w-full"
                    style={{ background: "repeating-linear-gradient(90deg, #292524 0px, #292524 60px, #1c1917 60px, #1c1917 120px)" }}>
                    <div className="absolute inset-x-0 top-0 h-1 bg-stone-600/50" />
                  </div>

                  {/* Road */}
                  <div className="relative h-8 w-full bg-stone-900">
                    <div className="absolute top-1/2 inset-x-0 border-dashed border-t-2 border-stone-600/40" />
                  </div>
                </div>
              )}

              {/* Login prompt */}
              {!user && (
                <div className="relative z-10 mt-8 text-center text-stone-500 pb-10">
                  <p className="text-sm">{t("bazaar.loginPrompt")}</p>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              INSIDE SHOP
          ════════════════════════════════════════════════════════════ */}
          {view === "inside" && activeShop && (
            <div className="relative min-h-screen animate-in fade-in zoom-in-95 duration-300">
              <div className="absolute inset-0">
                <img src={activeShop.bg_image ?? DEFAULT_BG} className="h-full w-full object-cover" alt="" role="presentation" />
                <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
              </div>

              <div className="relative z-10 flex min-h-screen flex-col p-5 md:p-8">
                {/* Header bar */}
                <div className="mb-6 flex items-start justify-between">
                  <div className="bg-black/80 border-l-4 px-5 py-3 rounded-e-lg" style={{ borderColor: activeShop.theme_color }}>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black md:text-3xl">{activeShop.name}</h2>
                      {activeTierCfg && (() => {
                        const TierIconActive = TIER_ICONS[activeShop.tier];
                        return (
                          <Badge className="text-xs flex items-center gap-1" style={{ backgroundColor: activeTierCfg.color + "33", color: activeTierCfg.color, border: `1px solid ${activeTierCfg.color}55` }}>
                            <TierIconActive className="h-3 w-3" aria-hidden="true" />
                            {tierLabel(activeShop.tier)}
                          </Badge>
                        );
                      })()}
                    </div>
                    {activeShop.description && <p className="mt-1 text-sm text-stone-300">{activeShop.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> {activeShop.trust_score ?? 70}% trust</span>
                      <span className="flex items-center gap-1 text-amber-300"><Star className="h-3.5 w-3.5 fill-current" /> {
                        reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : "New"
                      }</span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                        {t("bazaar.itemsInStock").replace("{count}", String(activeProducts.filter(p => p.in_stock).length))}
                    </p>
                  </div>
                  <button
                    onClick={() => { setView("street"); setActiveShop(null); playSound("close"); }}
                    className="rounded-full bg-white/10 p-2.5 hover:bg-white/20 transition-colors"
                    aria-label={t("bazaar.leaveShop")}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Products grid */}
                <div className="flex-1">
                  <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_160px]">
                    <div className="relative">
                      <Search className="absolute start-3 top-2.5 h-4 w-4 text-stone-400" />
                      <Input value={productSearch} onChange={event => setProductSearch(event.target.value)}
                        placeholder="Search products" className="border-white/20 bg-black/50 ps-9 text-white" />
                    </div>
                    <select value={productCategoryFilter} onChange={event => setProductCategoryFilter(event.target.value)}
                      className="rounded-md border border-white/20 bg-stone-950 px-3 text-sm">
                      <option value="all">All categories</option>
                      {PRODUCT_CATEGORIES.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}
                    </select>
                    <select value={productTypeFilter} onChange={event => setProductTypeFilter(event.target.value as "all" | ProductType)}
                      className="rounded-md border border-white/20 bg-stone-950 px-3 text-sm">
                      <option value="all">All types</option>
                      {PRODUCT_TYPES.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}
                    </select>
                  </div>
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center text-stone-400">
                      <Package className="h-12 w-12 opacity-30" />
                      <p>{isOwner ? t("bazaar.noProductsOwner") : t("bazaar.noProductsVisitor")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {filteredProducts.map(item => {
                        const productReviews = reviews.filter(review => review.product_id === item.id);
                        const rating = productReviews.length
                          ? productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length
                          : 0;
                        return (
                        <div key={item.id} className="relative rounded-lg bg-white/10 border border-white/20 backdrop-blur-md p-4 text-center transition-transform hover:-translate-y-1">
                          <button onClick={() => toggleWishlist(item)} aria-label="Save to wishlist"
                            className="absolute end-2 top-2 z-10 rounded-full bg-black/60 p-2 text-white hover:text-rose-400">
                            <Heart className="h-4 w-4" />
                          </button>
                          {item.image ? (
                            <button className="block w-full" onClick={() => setSelectedProduct(item)}>
                              <img src={item.image} alt={item.alt_text || item.name} className="mb-3 h-28 w-full rounded object-cover" />
                            </button>
                          ) : (
                            <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-white/5">
                              <Package className="h-8 w-8 opacity-30" />
                            </div>
                          )}
                          <h4 className="font-bold text-sm">{item.name}</h4>
                          <div className="mt-1 flex items-center justify-center gap-1 text-xs text-amber-300">
                            <Star className="h-3 w-3 fill-current" /> {rating ? rating.toFixed(1) : "New"} ({productReviews.length})
                          </div>
                          {item.description && <p className="mt-1 text-[11px] text-stone-400 line-clamp-2">{item.description}</p>}
                          <div className="mt-2 flex flex-wrap justify-center gap-2 font-black">
                            {item.accepts_vx && item.price_vx && <span className="text-amber-400">{Number(item.price_vx).toLocaleString()} VX</span>}
                            {item.accepts_cash && item.price_usd && <span className="text-emerald-400">${Number(item.price_usd).toFixed(2)}</span>}
                          </div>
                          {item.shelf_position && (
                            <p className="mt-0.5 text-[10px] uppercase text-stone-500 italic">{shelfLabel(item.shelf_position)}</p>
                          )}
                          <button
                            onClick={() => addBazaarItem(item)}
                            className="mt-3 w-full rounded-full bg-amber-500 py-1.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> {t("market.addToCart")}
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {cartItems.length > 0 && (
                  <div className="mt-6 border border-white/15 bg-black/70 p-4 backdrop-blur-md">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold"><ShoppingCart className="me-2 inline h-4 w-4" />{cartItems.length} items</p>
                        <p className="text-xs text-stone-400">
                          {cartSupportsVx && `${cartVxTotal.toLocaleString()} VX`}
                          {cartSupportsVx && cartSupportsCash && " / "}
                          {cartSupportsCash && `$${cartCashTotal.toFixed(2)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setBazaarCart({})}>Clear</Button>
                        {cartSupportsVx && (
                          <Button onClick={checkoutVX} disabled={checkoutLoading !== null || totalPoints < cartVxTotal}
                            className="bg-amber-500 text-black hover:bg-amber-400">
                            <Coins className="me-2 h-4 w-4" />{checkoutLoading === "vx" ? "Processing..." : "Pay with VX"}
                          </Button>
                        )}
                        {cartSupportsCash && (
                          <Button onClick={checkoutCash} disabled={checkoutLoading !== null}
                            className="bg-emerald-600 hover:bg-emerald-500">
                            <CreditCard className="me-2 h-4 w-4" />{checkoutLoading === "cash" ? "Opening..." : "Pay securely"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {!isOwner && (
                  <Button onClick={() => setView("chat")} className="rounded-full bg-blue-600 hover:bg-blue-500 px-7">
                    <MessageSquare className="me-2 h-4 w-4" /> {t("bazaar.talkToSeller")}
                  </Button>
                  )}
                  {isOwner && (
                    <Button onClick={() => setView("manage")} className="rounded-full bg-emerald-600 hover:bg-emerald-500 px-7">
                      <Settings className="me-2 h-4 w-4" /> {t("bazaar.manageShop")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              MANAGE SHOP (owner only)
          ════════════════════════════════════════════════════════════ */}
          {view === "manage" && activeShop && (
            <div className="mx-auto max-w-2xl px-4 py-10 animate-in fade-in slide-in-from-bottom-5 duration-300">
              <div className="mb-6 flex items-center gap-3">
                <button onClick={() => setView("inside")} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-emerald-400">{t("bazaar.manageShop")}</h2>
                  <p className="text-sm text-stone-400">{t("bazaar.productCapacity").replace("{shop}", activeShop.name).replace("{count}", String(activeProducts.length)).replace("{max}", activeTierCfg?.maxProducts === Infinity ? "∞" : String(activeTierCfg?.maxProducts ?? 0))}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: "Orders", value: sellerOrders.length, icon: Package },
                  { label: "Paid", value: sellerOrders.filter(order => order.status === "paid").length, icon: CheckCircle2 },
                  { label: "VX revenue", value: sellerOrders.reduce((sum, order) => sum + Number(order.total_vx || 0), 0).toLocaleString(), icon: Coins },
                  { label: "Cash revenue", value: `$${sellerOrders.reduce((sum, order) => sum + Number(order.total_usd || 0), 0).toFixed(2)}`, icon: DollarSign },
                ].map(stat => (
                  <div key={stat.label} className="border border-white/10 bg-white/5 p-3">
                    <stat.icon className="mb-2 h-4 w-4 text-emerald-400" />
                    <p className="text-xl font-black">{stat.value}</p>
                    <p className="text-xs text-stone-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mb-8 border border-white/10 bg-white/5 p-5">
                <h3 className="mb-4 flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-amber-400" /> Seller notifications</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</span>
                    <Switch checked={activeShop.email_notifications !== false}
                      onCheckedChange={checked => setActiveShop({ ...activeShop, email_notifications: checked })} />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> WhatsApp</span>
                    <Switch checked={!!activeShop.whatsapp_notifications}
                      onCheckedChange={checked => setActiveShop({ ...activeShop, whatsapp_notifications: checked })} />
                  </label>
                </div>
                <Input value={activeShop.whatsapp_number || ""}
                  onChange={event => setActiveShop({ ...activeShop, whatsapp_number: event.target.value })}
                  placeholder="+1234567890" className="mt-3 border-white/20 bg-black/20 text-white" />
                <p className="mt-1 text-xs text-stone-500">Use the full international number with country code.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([
                    ["Orders and payments", "order_notifications"],
                    ["Buyer messages", "message_notifications"],
                    ["Reviews", "review_notifications"],
                    ["Low stock", "low_stock_notifications"],
                  ] as const).map(([label, key]) => (
                    <label key={key} className="flex items-center justify-between gap-3 text-sm text-stone-300">
                      {label}
                      <Switch checked={activeShop[key] !== false}
                        onCheckedChange={checked => setActiveShop({ ...activeShop, [key]: checked })} />
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={saveShopSettings} disabled={settingsSaving} className="bg-emerald-600 hover:bg-emerald-500">
                    <Save className="me-2 h-4 w-4" />{settingsSaving ? "Saving..." : "Save settings"}
                  </Button>
                  <Button variant="outline" onClick={connectStripe} className="border-white/20">
                    <CreditCard className="me-2 h-4 w-4" />
                    {activeShop.stripe_onboarding_complete ? "Stripe connected" : "Connect cash payouts"}
                  </Button>
                </div>
              </div>

              {sellerOrders.length > 0 && (
                <div className="mb-8 border border-white/10 bg-white/5 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-bold"><BarChart3 className="h-4 w-4 text-blue-400" /> Recent orders</h3>
                  <div className="space-y-2">
                    {sellerOrders.slice(0, 8).map(order => (
                      <div key={order.id} className="flex items-center justify-between border-b border-white/10 py-2 text-sm last:border-0">
                        <div>
                          <p className="font-semibold">#{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-stone-500">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-end">
                          <Badge variant="outline">{order.status}</Badge>
                          <p className="mt-1 font-bold text-emerald-300">
                            {order.payment_method === "vx" ? `${Number(order.total_vx || 0).toLocaleString()} VX` : `$${Number(order.total_usd || 0).toFixed(2)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add product form */}
              <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="mb-4 font-bold text-white flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-400" /> {t("bazaar.addProduct")}</h3>
                <div className="mb-4 text-foreground">
                  <AITaskPanel
                    assistantId="bazaar-copilot"
                    title="VXBazaar AI listing copilot"
                    description="Improve the listing, pricing approach, accessibility text, and buyer clarity."
                    actions={[
                      { label: "Write listing", prompt: "Return only a publish-ready product description under 300 characters. No markdown, no preface." },
                      { label: "Accessible alt text", prompt: "Return only one concise image description for screen readers. If image details are missing, ask one short question instead of inventing visible details." },
                      { label: "Return policy", prompt: "Return only a clear, buyer-friendly return policy under 300 characters using the supplied product and shop context." },
                      { label: "Pricing review", prompt: "Review the VX and cash pricing approach. Explain assumptions; do not claim live market data." },
                      { label: "Trust check", prompt: "Review this listing for missing details, risky claims, or trust issues and give a short checklist." },
                    ]}
                    context={{ shop: activeShop?.name, product: productForm }}
                    onUseResult={applyListingCopilotResult}
                    compact
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="product-name" className="sr-only">{t("bazaar.productNameRequired")}</label>
                    <Input
                      id="product-name"
                      value={productForm.name}
                      onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                        placeholder={t("bazaar.productNamePlaceholder")}
                      aria-required="true"
                      className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <label htmlFor="product-description" className="sr-only">{t("bazaar.descriptionOptional")}</label>
                    <Textarea
                      id="product-description"
                      value={productForm.description}
                      onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))}
                      placeholder={t("bazaar.descriptionOptional")}
                      className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                      rows={2}
                      maxLength={300}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border border-white/10 p-3">
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold">
                        <span className="flex items-center gap-2"><Coins className="h-4 w-4 text-amber-400" /> VX price</span>
                        <Switch checked={productForm.accepts_vx} onCheckedChange={checked => setProductForm(p => ({ ...p, accepts_vx: checked }))} />
                      </label>
                      <Input type="number" min="1" step="1" value={productForm.price_vx}
                        onChange={e => setProductForm(p => ({ ...p, price_vx: e.target.value }))}
                        placeholder="Price in VX" disabled={!productForm.accepts_vx}
                        className="bg-white/10 border-white/20 text-white" />
                    </div>
                    <div className="border border-white/10 p-3">
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold">
                        <span className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-400" /> Cash price</span>
                        <Switch checked={productForm.accepts_cash} onCheckedChange={checked => setProductForm(p => ({ ...p, accepts_cash: checked }))} />
                      </label>
                      <Input type="number" min="0.5" step="0.01" value={productForm.price_usd}
                        onChange={e => setProductForm(p => ({ ...p, price_usd: e.target.value }))}
                        placeholder="USD price" disabled={!productForm.accepts_cash}
                        className="bg-white/10 border-white/20 text-white" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <select value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))}
                      className="rounded-md border border-white/20 bg-stone-900 px-3 py-2 text-sm text-white">
                      {PRODUCT_CATEGORIES.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}
                    </select>
                    <select value={productForm.product_type} onChange={e => setProductForm(p => ({ ...p, product_type: e.target.value as ProductType }))}
                      className="rounded-md border border-white/20 bg-stone-900 px-3 py-2 text-sm text-white">
                      {PRODUCT_TYPES.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}
                    </select>
                    <Input type="number" min="0" value={productForm.stock_qty}
                      onChange={e => setProductForm(p => ({ ...p, stock_qty: e.target.value }))}
                      placeholder="Stock" className="bg-white/10 border-white/20 text-white" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select value={productForm.shelf_position} onChange={e => setProductForm(p => ({ ...p, shelf_position: e.target.value }))}
                      className="rounded-md border border-white/20 bg-stone-900 px-3 py-2 text-sm text-white">
                      {SHELF_POSITIONS.map(pos => <option key={pos} value={pos}>{shelfLabel(pos)}</option>)}
                    </select>
                    <Input value={productForm.delivery_time} onChange={e => setProductForm(p => ({ ...p, delivery_time: e.target.value }))}
                      placeholder="Delivery time" className="bg-white/10 border-white/20 text-white" />
                    <Input value={productForm.shipping_from} onChange={e => setProductForm(p => ({ ...p, shipping_from: e.target.value }))}
                      placeholder="Ships from" className="bg-white/10 border-white/20 text-white" />
                    <Input type="number" min="0" step="0.01" value={productForm.shipping_cost}
                      onChange={e => setProductForm(p => ({ ...p, shipping_cost: e.target.value }))}
                      placeholder="Shipping USD" className="bg-white/10 border-white/20 text-white" />
                  </div>
                  <Textarea value={productForm.return_policy} onChange={e => setProductForm(p => ({ ...p, return_policy: e.target.value }))}
                    placeholder="Return policy" className="bg-white/10 border-white/20 text-white" rows={2} />
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-stone-400 shrink-0" />
                    <Input
                      value={productForm.image}
                      onChange={e => setProductForm(p => ({ ...p, image: e.target.value }))}
                      placeholder={t("bazaar.imageUrlOptional")}
                      className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    />
                  </div>
                  <Input value={productForm.alt_text} onChange={e => setProductForm(p => ({ ...p, alt_text: e.target.value }))}
                    placeholder="Image description for screen readers" className="bg-white/10 border-white/20 text-white" />
                  <label className="flex items-center justify-between text-sm text-stone-300">
                    Mark as accessible product
                    <Switch checked={productForm.is_accessible} onCheckedChange={checked => setProductForm(p => ({ ...p, is_accessible: checked }))} />
                  </label>
                  <Button
                    onClick={() => addProductMutation.mutate()}
                    disabled={!productForm.name.trim() || (!productForm.price_vx && !productForm.price_usd) || addProductMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    {addProductMutation.isPending ? t("bazaar.adding") : t("bazaar.addProduct")}
                  </Button>
                </div>
              </div>

              {/* Existing products list */}
              <div>
                  <h3 className="mb-3 font-bold text-stone-300">{t("bazaar.yourProducts")} ({activeProducts.length})</h3>
                {activeProducts.length === 0 ? (
                  <p className="text-stone-500 text-sm">{t("bazaar.noProductsYet")}</p>
                ) : (
                  <div className="space-y-2">
                    {activeProducts.map(item => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                              <Package className="h-5 w-5 opacity-30" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-sm text-white">{item.name}</p>
                            <p className="text-xs text-stone-400">
                              {item.accepts_vx && item.price_vx ? `${Number(item.price_vx).toLocaleString()} VX` : ""}
                              {item.accepts_vx && item.accepts_cash ? " / " : ""}
                              {item.accepts_cash && item.price_usd ? `$${Number(item.price_usd).toFixed(2)}` : ""}
                              {" · "}{item.stock_qty ?? 0} in stock
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteProduct(item.id)}
                          className="rounded-full p-1.5 text-stone-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          aria-label={t("bazaar.deleteProduct").replace("{name}", item.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              AI CHAT
          ════════════════════════════════════════════════════════════ */}
          {view === "chat" && activeShop && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="chat-dialog-title"
              className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900 md:inset-x-auto md:bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[500px] md:h-[75vh] md:rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300"
            >
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h3 id="chat-dialog-title" className="font-black flex items-center gap-2 text-lg">
                  <Store className="h-5 w-5 text-amber-500" aria-hidden="true" /> {activeShop.name}
                </h3>
                <button onClick={() => setView("inside")} className="text-slate-400 hover:text-slate-600" aria-label={t("bazaar.backToShop")}>
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div
                className="flex-1 overflow-y-auto space-y-3 p-5"
                role="log"
                aria-label={t("bazaar.chatWithShop").replace("{shop}", activeShop.name)}
                aria-live="polite"
                aria-relevant="additions"
              >
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                      m.sender === "user"
                        ? "bg-amber-500 text-white rounded-br-none"
                        : "bg-slate-100 text-slate-800 rounded-bl-none"
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl rounded-bl-none px-4 py-3 text-slate-400 text-sm animate-pulse">
                      {t("bazaar.typing")}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t p-4">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder={t("bazaar.askProductPlaceholder")}
                  className="rounded-xl"
                />
                <Button onClick={sendMessage} disabled={chatLoading} className="rounded-xl bg-amber-500 text-black hover:bg-amber-400 px-4">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              CREATE SHOP
          ════════════════════════════════════════════════════════════ */}
          {view === "create" && (
            <div className="mx-auto max-w-xl px-4 py-10 animate-in fade-in slide-in-from-bottom-8 duration-300">
              <div className="mb-8 flex items-center gap-3">
                <button onClick={() => setView("street")} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-2xl font-black text-amber-500">{t("bazaar.openShop")}</h2>
              </div>

              <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-300">{t("bazaar.shopName")}</label>
                  <Input
                    value={createForm.name}
                    onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    placeholder={t("bazaar.shopNamePlaceholder")}
                    className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    maxLength={60}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-300">{t("bazaar.description")}</label>
                  <Textarea
                    value={createForm.description}
                    onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={t("bazaar.shopDescriptionPlaceholder")}
                    className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    rows={2}
                    maxLength={200}
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-300">{t("bazaar.shopCountry")}</label>
                  <select
                    value={createForm.country}
                    onChange={e => setCreateForm(p => ({ ...p, country: e.target.value }))}
                    className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 [&>option]:bg-stone-900 [&>option]:text-white"
                  >
                    <option value="">{t("bazaar.noCountry")}</option>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {t(`vep.country.${c.code}`)}</option>
                    ))}
                  </select>
                </div>

                {/* Tier selection */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-300">{t("bazaar.chooseTier")}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(TIER_CONFIG) as [Tier, typeof TIER_CONFIG.kiosk][]).map(([key, cfg]) => {
                    const TierIconSel = TIER_ICONS[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setCreateForm(p => ({ ...p, tier: key }))}
                        className={`rounded-xl border p-3.5 text-left transition-all ${
                          createForm.tier === key
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-white/10 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <TierIconSel className="h-5 w-5" style={{ color: cfg.color }} aria-hidden="true" />
                          {createForm.tier === key && <Crown className="h-4 w-4 text-amber-400" />}
                        </div>
                        <p className="mt-1 font-bold">{tierLabel(key)}</p>
                        <p className="text-xs text-stone-400">{t("bazaar.upToProducts").replace("{max}", cfg.maxProducts === Infinity ? "∞" : String(cfg.maxProducts))}</p>
                        <p className="mt-2 text-xs font-bold text-amber-400">{t("bazaar.vxSetup").replace("{amount}", cfg.setupCost.toLocaleString())}</p>
                        <p className="text-xs text-stone-500">{t("bazaar.vxPerMonth").replace("{amount}", cfg.rentCost.toLocaleString())}</p>
                      </button>
                    );
                  })}
                  </div>
                </div>

                {/* Sign style */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-300">{t("bazaar.signStyle")}</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SIGN_STYLES).map(([style, cls]) => (
                      <button
                        key={style}
                        onClick={() => setCreateForm(p => ({ ...p, sign_style: style }))}
                        className={`rounded-lg border px-4 py-2 text-xs font-bold capitalize transition-all ${
                          createForm.sign_style === style
                            ? "border-amber-500 bg-amber-500/10 text-amber-400"
                            : "border-white/10 text-stone-400 hover:border-white/30"
                        }`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full me-1.5 ${cls.includes("amber") ? "bg-amber-400" : cls.includes("purple") ? "bg-purple-400" : cls.includes("blue") ? "bg-blue-400" : "bg-white"}`} />
                        {signStyleLabel(style)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme color */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-stone-300">{t("bazaar.themeColor")}</label>
                  <input
                    type="color"
                    value={createForm.theme_color}
                    onChange={e => setCreateForm(p => ({ ...p, theme_color: e.target.value }))}
                    className="h-9 w-16 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                  />
                  <span className="text-xs text-stone-500">{t("bazaar.themeColorHint")}</span>
                </div>

                <div className="border-t border-white/10 pt-5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-300">
                    <Bell className="h-4 w-4 text-amber-400" /> Seller notifications
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</span>
                      <Switch checked={createForm.email_notifications}
                        onCheckedChange={checked => setCreateForm(form => ({ ...form, email_notifications: checked }))} />
                    </label>
                    <label className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> WhatsApp</span>
                      <Switch checked={createForm.whatsapp_notifications}
                        onCheckedChange={checked => setCreateForm(form => ({ ...form, whatsapp_notifications: checked }))} />
                    </label>
                  </div>
                  {createForm.whatsapp_notifications && (
                    <Input value={createForm.whatsapp_number}
                      onChange={event => setCreateForm(form => ({ ...form, whatsapp_number: event.target.value }))}
                      placeholder="+1234567890" className="mt-3 bg-white/10 border-white/20 text-white" />
                  )}
                </div>

                {/* Cost summary */}
                {isOnTrial ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                    <p className="text-sm font-bold text-emerald-400">🎁 {t("bazaar.freeDuringTrial")}</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">{t("bazaar.yourBalance")}</span>
                      <span className="font-bold text-amber-400">{totalPoints.toLocaleString()} VX</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">{t("bazaar.setupCost")}</span>
                      <span className="font-bold text-red-400">−{TIER_CONFIG[createForm.tier].setupCost.toLocaleString()} VX</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                      <span>{t("bazaar.afterOpening")}</span>
                      <span className={totalPoints - TIER_CONFIG[createForm.tier].setupCost >= 0 ? "text-green-400" : "text-red-400"}>
                        {(totalPoints - TIER_CONFIG[createForm.tier].setupCost).toLocaleString()} VX
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => createShopMutation.mutate()}
                  disabled={!user || !createForm.name.trim() || createShopMutation.isPending || (!isOnTrial && totalPoints < TIER_CONFIG[createForm.tier].setupCost)}
                  className="w-full bg-amber-500 text-black hover:bg-amber-400 font-black py-5 text-base"
                >
                  {createShopMutation.isPending
                    ? t("bazaar.opening")
                    : isOnTrial
                      ? t("bazaar.openTierFree").replace("{tier}", tierLabel(createForm.tier))
                      : t("bazaar.openTierCost").replace("{tier}", tierLabel(createForm.tier)).replace("{amount}", TIER_CONFIG[createForm.tier].setupCost.toLocaleString())}
                </Button>

                {!user && <p className="text-center text-xs text-stone-500">{t("bazaar.loginToOpen")}</p>}
              </div>
            </div>
          )}

          <Dialog open={!!selectedProduct} onOpenChange={open => !open && setSelectedProduct(null)}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-stone-700 bg-stone-950 text-white">
              {selectedProduct && (
                <>
                  <DialogHeader>
                    <DialogTitle className="pe-8 text-2xl">{selectedProduct.name}</DialogTitle>
                    <DialogDescription className="text-stone-400">
                      {selectedProduct.description || "No description provided."}
                    </DialogDescription>
                  </DialogHeader>
                  {selectedProduct.image && (
                    <img src={selectedProduct.image} alt={selectedProduct.alt_text || selectedProduct.name}
                      className="max-h-72 w-full rounded object-cover" />
                  )}
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="border border-white/10 p-3">
                      <p className="text-xs text-stone-500">Payment options</p>
                      <div className="mt-1 flex flex-wrap gap-3 font-black">
                        {selectedProduct.accepts_vx && selectedProduct.price_vx && <span className="text-amber-400">{Number(selectedProduct.price_vx).toLocaleString()} VX</span>}
                        {selectedProduct.accepts_cash && selectedProduct.price_usd && <span className="text-emerald-400">${Number(selectedProduct.price_usd).toFixed(2)}</span>}
                      </div>
                    </div>
                    <div className="border border-white/10 p-3">
                      <p className="text-xs text-stone-500">Availability</p>
                      <p className="mt-1 font-semibold">{selectedProduct.stock_qty ?? 0} in stock</p>
                    </div>
                    <div className="border border-white/10 p-3">
                      <p className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4" /> Delivery</p>
                      <p className="mt-1 text-stone-400">{selectedProduct.delivery_time || "Contact seller"}{selectedProduct.shipping_from ? ` from ${selectedProduct.shipping_from}` : ""}</p>
                    </div>
                    <div className="border border-white/10 p-3">
                      <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Returns</p>
                      <p className="mt-1 text-stone-400">{selectedProduct.return_policy || "Contact seller before purchase"}</p>
                    </div>
                  </div>
                  <Button onClick={() => addBazaarItem(selectedProduct)} className="w-full bg-amber-500 text-black hover:bg-amber-400">
                    <ShoppingCart className="me-2 h-4 w-4" /> Add to bazaar cart
                  </Button>
                  <div className="border-t border-white/10 pt-4">
                    <h4 className="mb-3 font-bold">Buyer reviews</h4>
                    <div className="mb-4 max-h-36 space-y-2 overflow-y-auto">
                      {reviews.filter(review => review.product_id === selectedProduct.id).length === 0 ? (
                        <p className="text-sm text-stone-500">No reviews yet.</p>
                      ) : reviews.filter(review => review.product_id === selectedProduct.id).map(review => (
                        <div key={review.id} className="border-b border-white/10 pb-2 text-sm">
                          <p className="text-amber-300">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                          {review.comment && <p className="text-stone-300">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                    {user && !isOwner && (
                      <div className="space-y-2">
                        <select value={reviewForm.rating} onChange={event => setReviewForm(form => ({ ...form, rating: Number(event.target.value) }))}
                          className="w-full rounded-md border border-white/20 bg-stone-900 px-3 py-2 text-sm">
                          {[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} stars</option>)}
                        </select>
                        <Textarea value={reviewForm.comment} onChange={event => setReviewForm(form => ({ ...form, comment: event.target.value }))}
                          placeholder="Share your experience" className="border-white/20 bg-white/5 text-white" />
                        <Button variant="outline" onClick={submitReview} className="border-white/20">Publish review</Button>
                      </div>
                    )}
                  </div>
                  {user && !isOwner && (
                    <details className="border-t border-white/10 pt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-red-300">
                        <Flag className="me-2 inline h-4 w-4" /> Open buyer support case
                      </summary>
                      <div className="mt-3 space-y-2">
                        <select value={disputeForm.reason}
                          onChange={event => setDisputeForm(form => ({ ...form, reason: event.target.value }))}
                          className="w-full rounded-md border border-white/20 bg-stone-900 px-3 py-2 text-sm">
                          {DISPUTE_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                        </select>
                        <Textarea value={disputeForm.description}
                          onChange={event => setDisputeForm(form => ({ ...form, description: event.target.value }))}
                          placeholder="Describe the issue clearly" className="border-white/20 bg-white/5 text-white" />
                        <Button variant="destructive" onClick={submitDispute} disabled={!disputeForm.description.trim()}>
                          Submit support case
                        </Button>
                      </div>
                    </details>
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>

        </>
      </div>
    </Layout>
  );
}
