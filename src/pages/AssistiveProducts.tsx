import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  assistiveCategories, deliveryCountries, ACCESS_TYPE_CONFIG,
  type AssistiveProduct,
} from "@/data/assistiveProducts";
import {
  Bot, MessageCircle, Store, ChevronRight, Search, Link as LinkIcon,
  X, SlidersHorizontal, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { openAIChatWithProduct } from "@/components/AIChat";
import { Link } from "react-router-dom";
import { AnimatedSection } from "@/components/AnimatedSection";

export default function AssistiveProducts() {
  const { t, lang, dir } = useLanguage();
  const isRTL = dir === "rtl";

  // ── Helper translations ────────────────────────────────────────────────────
  const getProductName = (p: AssistiveProduct) => {
    if (lang === "ar") return p.nameAr;
    if (lang === "es") return p.nameEs;
    return p.nameEn;
  };
  const getCategoryName = (c: typeof assistiveCategories[0]) => {
    if (lang === "ar") return c.nameAr;
    if (lang === "es") return c.nameEs;
    return c.nameEn;
  };
  const getCountryName = (c: typeof deliveryCountries[0]) => {
    if (lang === "ar") return c.ar;
    if (lang === "es") return c.es;
    return c.en;
  };
  const getSpecs = (p: AssistiveProduct) => {
    if (lang === "ar") return p.specs.ar;
    if (lang === "es") return p.specs.es;
    return p.specs.en;
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [selected, setSelected]     = useState<Record<string, boolean>>({});
  const [deliveryChoices, setDeliveryChoices] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [openCategories, setOpenCategories] = useState<string[]>([assistiveCategories[0].id]);

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
        const dc = { ...deliveryChoices };
        delete dc[id];
        setDeliveryChoices(dc);
      } else {
        next[id] = true;
      }
      return next;
    });
  };

  const toggleCategoryAll = (catId: string) => {
    const cat = assistiveCategories.find(c => c.id === catId);
    if (!cat) return;
    const allSelected = cat.products.every(p => selected[p.id]);
    setSelected(prev => {
      const next = { ...prev };
      cat.products.forEach(p => {
        if (allSelected) delete next[p.id];
        else next[p.id] = true;
      });
      return next;
    });
  };

  // ── Filtered categories ───────────────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    return assistiveCategories.map(cat => ({
      ...cat,
      products: cat.products.filter(p => {
        const matchesSearch = !searchQuery ||
          getProductName(p).toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === "all" || p.accessType === filterType;
        return matchesSearch && matchesType;
      }),
    })).filter(cat => cat.products.length > 0);
  }, [searchQuery, filterType, lang]);

  // Expand searched categories automatically
  const searchOpenCategories = useMemo(() => {
    if (!searchQuery && filterType === "all") return openCategories;
    return filteredCategories.map(c => c.id);
  }, [filteredCategories, searchQuery, filterType, openCategories]);

  const selectedProducts = useMemo(
    () => assistiveCategories.flatMap(c => c.products.filter(p => selected[p.id])),
    [selected]
  );

  const totalProducts = assistiveCategories.reduce((s, c) => s + c.products.length, 0);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    if (selectedProducts.length === 0) { toast.error(t("vep.noSelection")); return; }
    const lines = selectedProducts.map(p => {
      const name = getProductName(p);
      const country = deliveryChoices[p.id]
        ? getCountryName(deliveryCountries.find(c => c.code === deliveryChoices[p.id])!)
        : t("vep.notSelected");
      return `• ${name} → ${t("vep.deliverTo")}: ${country}`;
    });
    const message = `${t("vep.whatsappIntro")}\n\n${lines.join("\n")}`;
    window.open(`https://wa.me/96170750609?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleAIConsultant = () => {
    if (selectedProducts.length === 0) { toast.error(t("vep.noSelection")); return; }
    const productNames = selectedProducts.map(p => p.nameEn).join(", ");
    openAIChatWithProduct(productNames, `Compare these assistive products and help me choose: ${productNames}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <section className="section-container py-12" aria-labelledby="vep-heading" dir={dir}>

        {/* Header */}
        <AnimatedSection>
          <div className="mb-8 text-center">
            <h1 id="vep-heading" className="mb-2 text-3xl font-bold sm:text-4xl">{t("vep.title")}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("vep.subtitle")}</p>
            <div className="mt-3 flex items-center justify-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Store className="h-4 w-4" /> {totalProducts} {t("vep.productsTotal") ?? "products"}
              </span>
              <span>·</span>
              <Link to="/services/find-it-for-me" className="text-primary hover:underline flex items-center gap-1">
                <LinkIcon className="h-3.5 w-3.5" />
                {t("find.title")}
              </Link>
            </div>
          </div>
        </AnimatedSection>

        {/* Search + Filter bar */}
        <AnimatedSection>
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
              <Input
                placeholder={t("vep.searchPlaceholder") ?? "Search products..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={isRTL ? "pr-9" : "pl-9"}
                dir={dir}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}
                  className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isRTL ? "left-3" : "right-3"}`}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-52 gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("vep.filterAll") ?? "All Types"}</SelectItem>
                {(Object.entries(ACCESS_TYPE_CONFIG) as [string, typeof ACCESS_TYPE_CONFIG[keyof typeof ACCESS_TYPE_CONFIG]][]).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.icon} {isRTL ? cfg.labelAr : cfg.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </AnimatedSection>

        {/* No results */}
        {filteredCategories.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-lg">{t("liveTV.noResults")}</p>
            <Button variant="ghost" className="mt-3" onClick={() => { setSearchQuery(""); setFilterType("all"); }}>
              {t("games.difficulty.select")} → Clear filters
            </Button>
          </div>
        )}

        {/* Categories accordion */}
        <Accordion
          type="multiple"
          value={searchOpenCategories}
          onValueChange={setOpenCategories}
          className="space-y-4"
        >
          {filteredCategories.map(category => {
            const catAllSelected = category.products.every(p => selected[p.id]);
            const catSomeSelected = category.products.some(p => selected[p.id]);

            return (
              <AccordionItem
                key={category.id}
                value={category.id}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <AccordionTrigger className="px-5 py-4 text-lg font-bold hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center justify-between w-full gap-3 pe-3">
                    <span className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">{category.icon}</span>
                      {getCategoryName(category)}
                      <Badge variant="secondary" className="text-xs">
                        {category.products.length}
                      </Badge>
                      {catSomeSelected && (
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                          ✓ {category.products.filter(p => selected[p.id]).length}
                        </Badge>
                      )}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleCategoryAll(category.id); }}
                      className="text-xs text-primary hover:underline whitespace-nowrap hidden sm:block"
                    >
                      {catAllSelected ? (t("vep.deselectAll") ?? "Deselect all") : (t("vep.selectAll") ?? "Select all")}
                    </button>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-5 pb-5">
                  <div className="grid gap-4">
                    {category.products.map(product => {
                      const isSelected = !!selected[product.id];
                      const typeCfg = ACCESS_TYPE_CONFIG[product.accessType];

                      return (
                        <Card
                          key={product.id}
                          className={`transition-all ${isSelected ? "ring-2 ring-primary shadow-md bg-primary/[0.02]" : "hover:shadow-sm"}`}
                        >
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={`product-${product.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleProduct(product.id)}
                                className="mt-1 h-5 w-5 shrink-0"
                                aria-label={getProductName(product)}
                              />
                              <div className="flex-1 min-w-0">

                                {/* Name + badges */}
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <label
                                    htmlFor={`product-${product.id}`}
                                    className="cursor-pointer text-base font-semibold leading-tight sm:text-lg"
                                  >
                                    {getProductName(product)}
                                  </label>
                                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    <Badge variant="outline" className={`text-xs gap-1 ${typeCfg.color}`}>
                                      {typeCfg.icon} {isRTL ? typeCfg.labelAr : typeCfg.labelEn}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Price range + stores */}
                                <div className="mt-1.5 flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1 font-semibold text-primary">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    {product.priceMin === 0
                                      ? `${t("content.free")} – $${product.priceMax.toLocaleString()}`
                                      : `$${product.priceMin.toLocaleString()} – $${product.priceMax.toLocaleString()}`
                                    }
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Store className="h-3.5 w-3.5 shrink-0" />
                                    {t("vep.storesCount").replace("{count}", String(product.storeCount))}
                                  </span>
                                </div>

                                {/* Specs */}
                                <ul className="mt-2 space-y-1">
                                  {getSpecs(product).map((spec, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                                      {spec}
                                    </li>
                                  ))}
                                </ul>

                                {/* Stores list */}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {product.stores.slice(0, 4).map(s => (
                                    <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{s}</span>
                                  ))}
                                  {product.stores.length > 4 && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{product.stores.length - 4}</span>
                                  )}
                                </div>

                                {/* Delivery — shown when selected */}
                                {isSelected && (
                                  <div className="mt-4 max-w-xs">
                                    <label className="mb-1.5 block text-sm font-medium">{t("vep.deliverTo")}</label>
                                    <Select
                                      value={deliveryChoices[product.id] || ""}
                                      onValueChange={val => setDeliveryChoices(prev => ({ ...prev, [product.id]: val }))}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("vep.selectCountry")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {deliveryCountries.map(country => (
                                          <SelectItem key={country.code} value={country.code}>
                                            {getCountryName(country)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {/* AI button */}
                                <Button
                                  variant="ghost" size="sm"
                                  className="mt-3 gap-1.5 text-xs text-primary hover:text-primary"
                                  onClick={() => openAIChatWithProduct(
                                    product.nameEn,
                                    `${t("ai.consultationPrompt").replace("{product}", getProductName(product))}`
                                  )}
                                >
                                  <Bot className="h-3.5 w-3.5" />
                                  {t("ai.consultation")}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Selected count */}
        {selectedProducts.length > 0 && (
          <p className="mt-6 text-center text-sm font-medium text-primary" aria-live="polite">
            {t("vep.selectedCount").replace("{count}", String(selectedProducts.length))}
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" className="gap-2 text-base px-6 py-6" onClick={handleAIConsultant}>
            <Bot className="h-5 w-5" />
            {t("vep.aiConsultant")}
          </Button>
          <Button
            size="lg" variant="outline" className="gap-2 text-base px-6 py-6"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-5 w-5 text-green-500" />
            {t("vep.whatsappBtn") ?? "Send Inquiry via WhatsApp"}
          </Button>
          <Button size="lg" variant="ghost" className="gap-2 text-base px-6 py-6" asChild>
            <Link to="/services/find-it-for-me">
              <LinkIcon className="h-5 w-5" />
              {t("find.title")}
            </Link>
          </Button>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-center text-xs text-muted-foreground max-w-xl mx-auto">
          {t("vep.priceDisclaimer") ?? "* Prices are approximate ranges based on current market data (2024–2025) and may vary by retailer, region, and model. Contact us for exact quotes."}
        </p>
      </section>
    </Layout>
  );
}
