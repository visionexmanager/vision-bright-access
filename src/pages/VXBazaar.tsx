import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Store, ShoppingCart, X, Plus, ArrowLeft,
  Coins, Crown, Package, Settings, Trash2, ImagePlus, CheckCircle2,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { useSound } from "@/contexts/SoundContext";
import { useAmbientSound } from "@/hooks/useAmbientSound";

// ── Types ──────────────────────────────────────────────────────────────────
type Tier = "kiosk" | "boutique" | "store" | "flagship";
type View = "street" | "inside" | "chat" | "create" | "manage";

interface Shop {
  id: string;
  owner_id: string;
  name: string;
  tier: Tier;
  description: string | null;
  theme_color: string;
  bg_image: string | null;
  sign_style: string;
  is_active: boolean;
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
}

interface ChatMessage {
  text: string;
  sender: "user" | "seller";
}

// ── Constants ──────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<Tier, { label: string; maxProducts: number; setupCost: number; rentCost: number; color: string; icon: string }> = {
  kiosk:    { label: "Kiosk",    maxProducts: 10,       setupCost: 5_000,   rentCost: 1_000,  color: "#6b7280", icon: "🏪" },
  boutique: { label: "Boutique", maxProducts: 50,       setupCost: 20_000,  rentCost: 3_000,  color: "#8b5cf6", icon: "🛍️" },
  store:    { label: "Store",    maxProducts: 200,      setupCost: 60_000,  rentCost: 8_000,  color: "#3b82f6", icon: "🏬" },
  flagship: { label: "Flagship", maxProducts: Infinity, setupCost: 150_000, rentCost: 20_000, color: "#f59e0b", icon: "👑" },
};

const SIGN_STYLES: Record<string, string> = {
  neon:   "shadow-[0_0_18px_rgba(245,158,11,0.7)] border-amber-400 text-amber-300",
  royal:  "shadow-[0_0_18px_rgba(139,92,246,0.7)] border-purple-400 text-purple-200",
  cyber:  "shadow-[0_0_18px_rgba(59,130,246,0.7)] border-blue-400 text-blue-200",
  simple: "border-white/50 text-white",
};

const SHELF_POSITIONS = ["Front Window", "Center Shelf", "Back Wall", "Display Stand", "Clearance Rack"];
const DEFAULT_BG = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200";

// ── Main Component ─────────────────────────────────────────────────────────
export default function VXBazaar() {
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { addToCart } = useCart();
  const { playSound } = useSound();
  useAmbientSound("marketplace");

  const [view, setView] = useState<View>("street");
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "", tier: "kiosk" as Tier, description: "",
    theme_color: "#f59e0b", sign_style: "neon",
  });
  const [productForm, setProductForm] = useState({
    name: "", description: "", price: "", image: "", shelf_position: "Front Window",
  });

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

  const myShop = shops.find(s => s.owner_id === user?.id);
  const isOwner = activeShop?.owner_id === user?.id;

  // ── Create shop ────────────────────────────────────────────────────────
  const createShopMutation = useMutation({
    mutationFn: async () => {
      const tierCfg = TIER_CONFIG[createForm.tier];
      if (totalPoints < tierCfg.setupCost) throw new Error("insufficient_points");

      const { error: shopError } = await supabase.from("bazaar_shops").insert({
        owner_id: user!.id,
        name: createForm.name.trim(),
        tier: createForm.tier,
        description: createForm.description.trim() || null,
        theme_color: createForm.theme_color,
        sign_style: createForm.sign_style,
        is_active: true,
      });
      if (shopError) throw shopError;

      await supabase.from("user_points").insert({
        user_id: user!.id,
        points: -tierCfg.setupCost,
        reason: `VXBazaar: Open ${tierCfg.label} — ${createForm.name.trim()}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bazaar-shops"] });
      queryClient.invalidateQueries({ queryKey: ["points-total"] });
      toast({ title: "Shop opened! Welcome to VXBazaar 🎉" });
      playSound("success");
      setView("street");
    },
    onError: (e: Error) => {
      if (e.message === "insufficient_points")
        toast({ title: "Not enough VX coins", variant: "destructive" });
      else
        toast({ title: "Failed to create shop", variant: "destructive" });
    },
  });

  // ── Add product ────────────────────────────────────────────────────────
  const addProductMutation = useMutation({
    mutationFn: async () => {
      if (!activeShop) throw new Error("no_shop");
      const tierCfg = TIER_CONFIG[activeShop.tier];
      if (activeProducts.length >= tierCfg.maxProducts)
        throw new Error("max_products");

      const { error } = await supabase.from("bazaar_products").insert({
        shop_id: activeShop.id,
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        price: parseFloat(productForm.price),
        image: productForm.image.trim() || null,
        shelf_position: productForm.shelf_position,
        in_stock: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchProducts();
      setProductForm({ name: "", description: "", price: "", image: "", shelf_position: "Front Window" });
      toast({ title: "Product added! 🛒" });
      playSound("click");
    },
    onError: (e: Error) => {
      if (e.message === "max_products")
        toast({ title: `Max products reached for this tier`, variant: "destructive" });
      else
        toast({ title: "Failed to add product", variant: "destructive" });
    },
  });

  // ── Delete product ─────────────────────────────────────────────────────
  const deleteProduct = async (id: string) => {
    await supabase.from("bazaar_products").delete().eq("id", id);
    refetchProducts();
    toast({ title: "Product removed" });
  };

  // ── Enter shop ────────────────────────────────────────────────────────
  const enterShop = useCallback((shop: Shop) => {
    setActiveShop(shop);
    setMessages([{ text: `Welcome to ${shop.name}! How can I help you today?`, sender: "seller" }]);
    setView("inside");
    playSound("open");
    if ("speechSynthesis" in window) {
      const msg = new SpeechSynthesisUtterance(`Welcome to ${shop.name}`);
      window.speechSynthesis.speak(msg);
    }
  }, []);

  // ── AI Chat ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    playSound("send");
    setMessages(prev => [...prev, { text: userMsg, sender: "user" }]);
    setChatLoading(true);

    try {
      const inStockProducts = activeProducts.filter(p => p.in_stock);
      const context = `You are a helpful seller at "${activeShop?.name}", a shop in VXBazaar. Products: ${
        inStockProducts.map(p => `${p.name} ($${p.price})`).join(", ") || "none listed yet"
      }. Be brief and helpful.`;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ messages: [{ role: "system", content: context }, { role: "user", content: userMsg }] }),
        }
      );

      let reply = "Sorry, I'm unavailable right now. Please try again later.";
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, "");
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const c = JSON.parse(json).choices?.[0]?.delta?.content;
              if (c) full += c;
            } catch { /* */ }
          }
        }
        if (full) reply = full;
      }
      setMessages(prev => [...prev, { text: reply, sender: "seller" }]);
    } catch {
      setMessages(prev => [...prev, { text: "Connection error. Please try again.", sender: "seller" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const activeTierCfg = activeShop ? TIER_CONFIG[activeShop.tier] : null;
  const signClass = activeShop ? (SIGN_STYLES[activeShop.sign_style] ?? SIGN_STYLES.neon) : "";

  return (
    <Layout>
      <div className="min-h-screen overflow-hidden" style={{ background: "linear-gradient(180deg, #0d0a1a 0%, #1a0d2e 40%, #0f1520 100%)" }}>
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════════
              STREET VIEW
          ════════════════════════════════════════════════════════════ */}
          {view === "street" && (
            <motion.div key="street" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

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

              {/* Header */}
              <div className="relative z-10 px-4 pt-10 pb-4 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs text-amber-400 mb-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> OPEN FOR BUSINESS
                </div>
                <h1 className="text-5xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600 md:text-6xl"
                  style={{ textShadow: "0 0 40px rgba(245,158,11,0.4)" }}>
                  VXBazaar
                </h1>
                <p className="mt-1 text-stone-400">The marketplace built by you, for everyone</p>

                {user && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-bold text-amber-400">
                      <Coins className="h-4 w-4" /> {totalPoints.toLocaleString()} VX
                    </span>
                    {myShop ? (
                      <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => enterShop(myShop)}>
                        <Store className="me-1.5 h-4 w-4" /> My Shop
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 font-bold" onClick={() => setView("create")}>
                        <Plus className="me-1.5 h-4 w-4" /> Open a Shop
                      </Button>
                    )}
                  </div>
                )}
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
                <div className="flex justify-center py-20 text-stone-500">Loading shops...</div>
              ) : shops.length === 0 ? (
                <div className="relative z-10 flex flex-col items-center gap-4 py-20 text-center text-stone-500">
                  <Store className="h-16 w-16 opacity-20" />
                  <p className="text-lg text-stone-400">No shops yet — be the first to open one!</p>
                  {user && (
                    <Button className="bg-amber-500 text-black hover:bg-amber-400 font-bold" onClick={() => setView("create")}>
                      <Plus className="me-2 h-4 w-4" /> Open a Shop
                    </Button>
                  )}
                </div>
              ) : (
                <div className="relative z-10">
                  {/* Building tops strip */}
                  <div className="flex gap-8 overflow-x-hidden px-8">
                    {shops.map(shop => {
                      const cfg = TIER_CONFIG[shop.tier];
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
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ color: cfg.color, backgroundColor: cfg.color + "22" }}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Shop facades row */}
                  <div className="flex gap-8 overflow-x-auto pb-0 px-8 snap-x snap-mandatory scrollbar-thin scrollbar-track-stone-900 scrollbar-thumb-amber-600">
                    {shops.map(shop => {
                      const sign = SIGN_STYLES[shop.sign_style] ?? SIGN_STYLES.neon;
                      return (
                        <motion.div
                          key={shop.id}
                          whileHover={{ y: -6, scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          className="relative min-w-[300px] h-[400px] snap-center flex-shrink-0 cursor-pointer md:min-w-[360px]"
                          onClick={() => enterShop(shop)}
                          role="button"
                          aria-label={`Enter ${shop.name}`}
                          tabIndex={0}
                          onKeyDown={e => e.key === "Enter" && enterShop(shop)}
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
                                  Step Inside →
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
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
                  <p className="text-sm">Log in to open your own shop or chat with sellers</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════
              INSIDE SHOP
          ════════════════════════════════════════════════════════════ */}
          {view === "inside" && activeShop && (
            <motion.div key="inside" initial={{ scale: 1.04, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="relative min-h-screen">
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
                      {activeTierCfg && (
                        <Badge className="text-xs" style={{ backgroundColor: activeTierCfg.color + "33", color: activeTierCfg.color, border: `1px solid ${activeTierCfg.color}55` }}>
                          {activeTierCfg.icon} {activeTierCfg.label}
                        </Badge>
                      )}
                    </div>
                    {activeShop.description && <p className="mt-1 text-sm text-stone-300">{activeShop.description}</p>}
                    <p className="mt-1 text-xs text-stone-500">{activeProducts.filter(p => p.in_stock).length} items in stock</p>
                  </div>
                  <button
                    onClick={() => { setView("street"); setActiveShop(null); playSound("close"); }}
                    className="rounded-full bg-white/10 p-2.5 hover:bg-white/20 transition-colors"
                    aria-label="Leave shop"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Products grid */}
                <div className="flex-1">
                  {activeProducts.filter(p => p.in_stock).length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center text-stone-400">
                      <Package className="h-12 w-12 opacity-30" />
                      <p>{isOwner ? t("bazaar.noProductsOwner") : t("bazaar.noProductsVisitor")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {activeProducts.filter(p => p.in_stock).map(item => {
                        const handleAddToCart = () => {
                          addToCart({
                            id: item.id,
                            name: item.name,
                            description: item.description ?? "",
                            price: Number(item.price),
                            category: "bazaar",
                            points: 0,
                            image: item.image ?? "",
                            rating: 0,
                            inStock: item.in_stock,
                          });
                          toast({ title: t("market.addedToCart") || `${item.name} added to cart` });
                          playSound("points");
                        };
                        return (
                        <motion.div
                          key={item.id}
                          whileHover={{ scale: 1.04 }}
                          className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-md p-4 text-center"
                        >
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="mb-3 h-28 w-full rounded-lg object-cover" />
                          ) : (
                            <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-white/5">
                              <Package className="h-8 w-8 opacity-30" />
                            </div>
                          )}
                          <h4 className="font-bold text-sm">{item.name}</h4>
                          {item.description && <p className="mt-1 text-[11px] text-stone-400 line-clamp-2">{item.description}</p>}
                          <p className="mt-2 font-black text-amber-400">${item.price}</p>
                          {item.shelf_position && (
                            <p className="mt-0.5 text-[10px] uppercase text-stone-500 italic">{item.shelf_position}</p>
                          )}
                          <button
                            onClick={handleAddToCart}
                            className="mt-3 w-full rounded-full bg-amber-500 py-1.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> {t("market.addToCart") || "Add to Cart"}
                          </button>
                        </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button onClick={() => setView("chat")} className="rounded-full bg-blue-600 hover:bg-blue-500 px-7">
                    <MessageSquare className="me-2 h-4 w-4" /> {t("bazaar.talkToSeller")}
                  </Button>
                  {isOwner && (
                    <Button onClick={() => setView("manage")} className="rounded-full bg-emerald-600 hover:bg-emerald-500 px-7">
                      <Settings className="me-2 h-4 w-4" /> {t("bazaar.manageShop")}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════
              MANAGE SHOP (owner only)
          ════════════════════════════════════════════════════════════ */}
          {view === "manage" && activeShop && (
            <motion.div key="manage" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-2xl px-4 py-10">
              <div className="mb-6 flex items-center gap-3">
                <button onClick={() => setView("inside")} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-emerald-400">Manage Shop</h2>
                  <p className="text-sm text-stone-400">{activeShop.name} · {activeProducts.length} / {activeTierCfg?.maxProducts === Infinity ? "∞" : activeTierCfg?.maxProducts} products</p>
                </div>
              </div>

              {/* Add product form */}
              <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="mb-4 font-bold text-white flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-400" /> Add New Product</h3>
                <div className="space-y-3">
                  <Input
                    value={productForm.name}
                    onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Product name *"
                    className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    maxLength={80}
                  />
                  <Textarea
                    value={productForm.description}
                    onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description (optional)"
                    className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    rows={2}
                    maxLength={300}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={productForm.price}
                      onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))}
                      placeholder="Price ($) *"
                      className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    />
                    <select
                      value={productForm.shelf_position}
                      onChange={e => setProductForm(p => ({ ...p, shelf_position: e.target.value }))}
                      className="rounded-md border border-white/20 bg-stone-900 text-white text-sm px-3 py-2"
                    >
                      {SHELF_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-stone-400 shrink-0" />
                    <Input
                      value={productForm.image}
                      onChange={e => setProductForm(p => ({ ...p, image: e.target.value }))}
                      placeholder="Image URL (optional)"
                      className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    />
                  </div>
                  <Button
                    onClick={() => addProductMutation.mutate()}
                    disabled={!productForm.name.trim() || !productForm.price || addProductMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    {addProductMutation.isPending ? "Adding..." : "Add Product"}
                  </Button>
                </div>
              </div>

              {/* Existing products list */}
              <div>
                <h3 className="mb-3 font-bold text-stone-300">Your Products ({activeProducts.length})</h3>
                {activeProducts.length === 0 ? (
                  <p className="text-stone-500 text-sm">No products yet.</p>
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
                            <p className="text-xs text-stone-400">${item.price} · {item.shelf_position}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteProduct(item.id)}
                          className="rounded-full p-1.5 text-stone-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════
              AI CHAT
          ════════════════════════════════════════════════════════════ */}
          {view === "chat" && activeShop && (
            <motion.div
              key="chat"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900 md:inset-x-auto md:bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[500px] md:h-[75vh] md:rounded-t-3xl shadow-2xl"
            >
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h3 className="font-black flex items-center gap-2 text-lg">
                  <Store className="h-5 w-5 text-amber-500" /> {activeShop.name}
                </h3>
                <button onClick={() => setView("inside")} className="text-slate-400 hover:text-slate-600" aria-label="Back to shop">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 p-5">
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
                      Typing…
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t p-4">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Ask about a product…"
                  className="rounded-xl"
                />
                <Button onClick={sendMessage} disabled={chatLoading} className="rounded-xl bg-amber-500 text-black hover:bg-amber-400 px-4">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════
              CREATE SHOP
          ════════════════════════════════════════════════════════════ */}
          {view === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-xl px-4 py-10">
              <div className="mb-8 flex items-center gap-3">
                <button onClick={() => setView("street")} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-2xl font-black text-amber-500">Open Your Shop</h2>
              </div>

              <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-300">Shop Name *</label>
                  <Input
                    value={createForm.name}
                    onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="My Amazing Shop"
                    className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    maxLength={60}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-300">Description</label>
                  <Textarea
                    value={createForm.description}
                    onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="What do you sell?"
                    className="bg-white/10 border-white/20 text-white placeholder:text-stone-500"
                    rows={2}
                    maxLength={200}
                  />
                </div>

                {/* Tier selection */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-300">Choose Your Tier</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(TIER_CONFIG) as [Tier, typeof TIER_CONFIG.kiosk][]).map(([key, cfg]) => (
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
                          <span className="text-lg">{cfg.icon}</span>
                          {createForm.tier === key && <Crown className="h-4 w-4 text-amber-400" />}
                        </div>
                        <p className="mt-1 font-bold">{cfg.label}</p>
                        <p className="text-xs text-stone-400">Up to {cfg.maxProducts === Infinity ? "∞" : cfg.maxProducts} products</p>
                        <p className="mt-2 text-xs font-bold text-amber-400">{cfg.setupCost.toLocaleString()} VX setup</p>
                        <p className="text-xs text-stone-500">{cfg.rentCost.toLocaleString()} VX/month</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sign style */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-300">Sign Style</label>
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
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme color */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-stone-300">Theme Color</label>
                  <input
                    type="color"
                    value={createForm.theme_color}
                    onChange={e => setCreateForm(p => ({ ...p, theme_color: e.target.value }))}
                    className="h-9 w-16 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                  />
                  <span className="text-xs text-stone-500">Used for borders & accents</span>
                </div>

                {/* Cost summary */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Your balance</span>
                    <span className="font-bold text-amber-400">{totalPoints.toLocaleString()} VX</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Setup cost</span>
                    <span className="font-bold text-red-400">−{TIER_CONFIG[createForm.tier].setupCost.toLocaleString()} VX</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                    <span>After opening</span>
                    <span className={totalPoints - TIER_CONFIG[createForm.tier].setupCost >= 0 ? "text-green-400" : "text-red-400"}>
                      {(totalPoints - TIER_CONFIG[createForm.tier].setupCost).toLocaleString()} VX
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => createShopMutation.mutate()}
                  disabled={!createForm.name.trim() || createShopMutation.isPending || totalPoints < TIER_CONFIG[createForm.tier].setupCost}
                  className="w-full bg-amber-500 text-black hover:bg-amber-400 font-black py-5 text-base"
                >
                  {createShopMutation.isPending
                    ? "Opening…"
                    : `Open ${TIER_CONFIG[createForm.tier].label} — ${TIER_CONFIG[createForm.tier].setupCost.toLocaleString()} VX`}
                </Button>

                {!user && <p className="text-center text-xs text-stone-500">You must be logged in to open a shop</p>}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Layout>
  );
}
