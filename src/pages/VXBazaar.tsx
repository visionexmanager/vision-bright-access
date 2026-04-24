import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, Store, ShoppingCart, X, Plus, ArrowLeft, Coins, Crown, Package } from "lucide-react";
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

// ── Types ──────────────────────────────────────────────────────────────────
type Tier = "kiosk" | "boutique" | "store" | "flagship";

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

// ── Tier config ────────────────────────────────────────────────────────────
const TIERS: Record<Tier, { label: string; maxProducts: number; setupCost: number; rentCost: number; color: string; icon: string }> = {
  kiosk:    { label: "Kiosk",    maxProducts: 10,  setupCost: 5000,   rentCost: 1000,  color: "#6b7280", icon: "🏪" },
  boutique: { label: "Boutique", maxProducts: 50,  setupCost: 20000,  rentCost: 3000,  color: "#8b5cf6", icon: "🛍️" },
  store:    { label: "Store",    maxProducts: 200, setupCost: 60000,  rentCost: 8000,  color: "#3b82f6", icon: "🏬" },
  flagship: { label: "Flagship", maxProducts: Infinity, setupCost: 150000, rentCost: 20000, color: "#f59e0b", icon: "👑" },
};

const SIGN_STYLES: Record<string, string> = {
  neon:   "shadow-[0_0_15px_rgba(245,158,11,0.6)] border-amber-400 text-amber-400",
  royal:  "shadow-[0_0_15px_rgba(139,92,246,0.6)] border-purple-400 text-purple-300",
  cyber:  "shadow-[0_0_15px_rgba(59,130,246,0.6)] border-blue-400 text-blue-300",
  simple: "border-white/40 text-white",
};

const DEFAULT_BG = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200";

// ── Main Component ─────────────────────────────────────────────────────────
export default function VXBazaar() {
  const { user } = useAuth();
  const { totalPoints } = usePoints();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"street" | "inside" | "chat" | "create">("street");
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", tier: "kiosk" as Tier, description: "", theme_color: "#f59e0b", sign_style: "neon" });

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ["bazaar-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bazaar_shops").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Shop[];
    },
  });

  const { data: activeProducts = [] } = useQuery({
    queryKey: ["bazaar-products", activeShop?.id],
    enabled: !!activeShop,
    queryFn: async () => {
      const { data, error } = await supabase.from("bazaar_products").select("*").eq("shop_id", activeShop!.id).eq("in_stock", true);
      if (error) throw error;
      return data as BazaarProduct[];
    },
  });

  const myShop = shops.find(s => s.owner_id === user?.id);

  // ── Create shop ────────────────────────────────────────────────────────
  const createShopMutation = useMutation({
    mutationFn: async () => {
      const tier = TIERS[createForm.tier];
      if (totalPoints < tier.setupCost) throw new Error("insufficient_points");

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

      // Deduct VX points
      await supabase.from("user_points").insert({ user_id: user!.id, points: -tier.setupCost, description: `VXBazaar: Open ${tier.label}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bazaar-shops"] });
      queryClient.invalidateQueries({ queryKey: ["points-total"] });
      toast({ title: "Shop opened! Welcome to VXBazaar 🎉" });
      setView("street");
    },
    onError: (e: Error) => {
      if (e.message === "insufficient_points") toast({ title: "Not enough VX coins", variant: "destructive" });
      else toast({ title: "Failed to create shop", variant: "destructive" });
    },
  });

  // ── Enter shop ────────────────────────────────────────────────────────
  const enterShop = useCallback((shop: Shop) => {
    setActiveShop(shop);
    setMessages([{ text: `Welcome to ${shop.name}! How can I help you today?`, sender: "seller" }]);
    setView("inside");
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
    setMessages(prev => [...prev, { text: userMsg, sender: "user" }]);
    setChatLoading(true);

    try {
      const context = `You are a helpful seller at "${activeShop?.name}", a shop in VXBazaar. Products: ${activeProducts.map(p => `${p.name} ($${p.price})`).join(", ") || "none listed yet"}. Be brief and helpful.`;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ messages: [{ role: "system", content: context }, { role: "user", content: userMsg }] }),
      });

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
            try { const c = JSON.parse(json).choices?.[0]?.delta?.content; if (c) full += c; } catch { /* */ }
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

  const tier = activeShop ? TIERS[activeShop.tier] : null;
  const signClass = activeShop ? (SIGN_STYLES[activeShop.sign_style] ?? SIGN_STYLES.neon) : "";

  return (
    <Layout>
      <div className="min-h-screen bg-stone-950 text-white overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ── Street view ──────────────────────────────────────────── */}
          {view === "street" && (
            <motion.div key="street" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-10 md:px-10">
              <div className="mb-10 flex flex-col items-center gap-2 text-center">
                <h1 className="text-4xl font-black tracking-widest uppercase text-amber-500 md:text-5xl">VXBazaar</h1>
                <p className="text-stone-400">The marketplace built by you, for everyone</p>
                {user && (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-4 py-1.5 text-sm font-bold text-amber-400">
                      <Coins className="h-4 w-4" /> {totalPoints.toLocaleString()} VX
                    </span>
                    {myShop ? (
                      <Button size="sm" variant="outline" onClick={() => enterShop(myShop)}>
                        <Store className="me-1.5 h-4 w-4" /> My Shop
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400" onClick={() => setView("create")}>
                        <Plus className="me-1.5 h-4 w-4" /> Open a Shop
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {shopsLoading ? (
                <div className="flex justify-center py-20 text-stone-500">Loading shops...</div>
              ) : shops.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-20 text-center text-stone-500">
                  <Store className="h-16 w-16 opacity-30" />
                  <p className="text-lg">No shops yet — be the first to open one!</p>
                  {user && <Button className="bg-amber-500 text-black hover:bg-amber-400" onClick={() => setView("create")}><Plus className="me-2 h-4 w-4" /> Open a Shop</Button>}
                </div>
              ) : (
                <div className="flex gap-8 overflow-x-auto pb-10 snap-x snap-mandatory">
                  {shops.map(shop => {
                    const t = TIERS[shop.tier];
                    const sign = SIGN_STYLES[shop.sign_style] ?? SIGN_STYLES.neon;
                    return (
                      <motion.div
                        key={shop.id}
                        whileHover={{ y: -8 }}
                        className="relative min-w-[300px] h-[440px] rounded-t-[40px] border-4 border-stone-700 snap-center shadow-2xl overflow-hidden flex-shrink-0 cursor-pointer md:min-w-[360px]"
                        onClick={() => enterShop(shop)}
                      >
                        <img src={shop.bg_image ?? DEFAULT_BG} className="absolute inset-0 h-full w-full object-cover opacity-50" alt={shop.name} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Shop sign */}
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 px-5 py-2 border rounded-md ${sign}`}>
                          <span className="font-bold whitespace-nowrap uppercase tracking-tight text-sm">{shop.name}</span>
                        </div>

                        {/* Tier badge */}
                        <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: t.color + "33", color: t.color, border: `1px solid ${t.color}55` }}>
                          {t.icon} {t.label}
                        </div>

                        <div className="absolute bottom-8 inset-x-0 flex justify-center">
                          <button className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full font-bold transition-all">
                            Step Inside
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Inside shop ──────────────────────────────────────────── */}
          {view === "inside" && activeShop && (
            <motion.div key="inside" initial={{ scale: 1.05, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="relative min-h-screen">
              <div className="absolute inset-0">
                <img src={activeShop.bg_image ?? DEFAULT_BG} className="h-full w-full object-cover" alt="" />
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
              </div>

              <div className="relative z-10 flex h-full min-h-screen flex-col p-6 md:p-10">
                {/* Header */}
                <div className="mb-8 flex items-start justify-between">
                  <div className="bg-black/80 border-l-4 px-5 py-3" style={{ borderColor: activeShop.theme_color }}>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black md:text-3xl">{activeShop.name}</h2>
                      {tier && <Badge className="text-xs" style={{ backgroundColor: tier.color + "33", color: tier.color }}>{tier.icon} {tier.label}</Badge>}
                    </div>
                    {activeShop.description && <p className="mt-1 text-sm text-stone-300">{activeShop.description}</p>}
                  </div>
                  <button onClick={() => { setView("street"); setActiveShop(null); }} className="rounded-full bg-white/10 p-2.5 hover:bg-white/20 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Products grid */}
                <div className="flex-1">
                  {activeProducts.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center text-stone-400">
                      <Package className="h-12 w-12 opacity-40" />
                      <p>No products yet in this shop.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {activeProducts.map(item => (
                        <motion.div key={item.id} whileHover={{ scale: 1.04 }} className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-md p-4 text-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="mb-3 h-28 w-full rounded-lg object-cover" />
                          ) : (
                            <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-white/5">
                              <Package className="h-8 w-8 opacity-40" />
                            </div>
                          )}
                          <h4 className="font-bold text-sm">{item.name}</h4>
                          {item.description && <p className="mt-1 text-[11px] text-stone-400 line-clamp-2">{item.description}</p>}
                          <p className="mt-2 font-black text-amber-400">${item.price}</p>
                          {item.shelf_position && <p className="mt-1 text-[10px] uppercase text-stone-500 italic">{item.shelf_position}</p>}
                          <button className="mt-3 w-full rounded-full bg-amber-500 py-1.5 text-xs font-bold text-black hover:bg-amber-400 transition-colors flex items-center justify-center gap-1">
                            <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="mt-8 flex justify-center gap-4">
                  <Button onClick={() => setView("chat")} className="rounded-full bg-blue-600 hover:bg-blue-500 px-8">
                    <MessageSquare className="me-2 h-4 w-4" /> Talk to Seller
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Chat ─────────────────────────────────────────────────── */}
          {view === "chat" && activeShop && (
            <motion.div key="chat" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900 md:inset-x-auto md:bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[500px] md:h-[75vh] md:rounded-t-3xl shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h3 className="font-black flex items-center gap-2 text-lg">
                  <Store className="h-5 w-5 text-amber-500" /> {activeShop.name}
                </h3>
                <button onClick={() => setView("inside")} className="text-slate-400 hover:text-slate-600">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 p-6">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3.5 text-sm leading-relaxed ${m.sender === "user" ? "bg-amber-500 text-white rounded-br-none" : "bg-slate-100 text-slate-800 rounded-bl-none"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl rounded-bl-none px-4 py-3 text-slate-400 text-sm">Typing...</div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t p-4">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Ask about a product..."
                  className="rounded-xl"
                />
                <Button onClick={sendMessage} disabled={chatLoading} className="rounded-xl bg-amber-500 text-black hover:bg-amber-400 px-4">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Create shop ───────────────────────────────────────────── */}
          {view === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-xl px-4 py-10 md:px-0">
              <div className="mb-8 flex items-center gap-3">
                <button onClick={() => setView("street")} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-2xl font-black text-amber-500">Open Your Shop</h2>
              </div>

              <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-300">Shop Name</label>
                  <Input value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="My Amazing Shop" className="bg-white/10 border-white/20 text-white placeholder:text-stone-500" maxLength={60} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-300">Description</label>
                  <Textarea value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} placeholder="What do you sell?" className="bg-white/10 border-white/20 text-white placeholder:text-stone-500" rows={2} maxLength={200} />
                </div>

                {/* Tier selection */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-300">Choose Your Tier</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(TIERS) as [Tier, typeof TIERS.kiosk][]).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => setCreateForm(p => ({ ...p, tier: key }))}
                        className={`rounded-xl border p-3.5 text-left transition-all ${createForm.tier === key ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{t.icon}</span>
                          {createForm.tier === key && <Crown className="h-4 w-4 text-amber-400" />}
                        </div>
                        <p className="mt-1 font-bold">{t.label}</p>
                        <p className="text-xs text-stone-400">Up to {t.maxProducts === Infinity ? "∞" : t.maxProducts} products</p>
                        <p className="mt-2 text-xs font-bold text-amber-400">{t.setupCost.toLocaleString()} VX setup</p>
                        <p className="text-xs text-stone-500">{t.rentCost.toLocaleString()} VX/month</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sign style */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-300">Sign Style</label>
                  <div className="flex gap-2">
                    {Object.entries(SIGN_STYLES).map(([style]) => (
                      <button
                        key={style}
                        onClick={() => setCreateForm(p => ({ ...p, sign_style: style }))}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold capitalize transition-all ${createForm.sign_style === style ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-white/10 text-stone-400 hover:border-white/30"}`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme color */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-stone-300">Theme Color</label>
                  <input type="color" value={createForm.theme_color} onChange={e => setCreateForm(p => ({ ...p, theme_color: e.target.value }))} className="h-9 w-16 cursor-pointer rounded-lg border border-white/20 bg-transparent" />
                </div>

                {/* Cost summary */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Your balance</span>
                    <span className="font-bold text-amber-400">{totalPoints.toLocaleString()} VX</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-stone-400">Setup cost</span>
                    <span className="font-bold text-red-400">-{TIERS[createForm.tier].setupCost.toLocaleString()} VX</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-bold">
                    <span>After opening</span>
                    <span className={totalPoints - TIERS[createForm.tier].setupCost >= 0 ? "text-green-400" : "text-red-400"}>
                      {(totalPoints - TIERS[createForm.tier].setupCost).toLocaleString()} VX
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => createShopMutation.mutate()}
                  disabled={!createForm.name.trim() || createShopMutation.isPending || totalPoints < TIERS[createForm.tier].setupCost}
                  className="w-full bg-amber-500 text-black hover:bg-amber-400 font-bold py-5"
                >
                  {createShopMutation.isPending ? "Opening..." : `Open ${TIERS[createForm.tier].label} — ${TIERS[createForm.tier].setupCost.toLocaleString()} VX`}
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Layout>
  );
}
