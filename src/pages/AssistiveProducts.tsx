import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage, Lang } from "@/contexts/LanguageContext";
import { assistiveCategories, deliveryCountries, AssistiveProduct } from "@/data/assistiveProducts";
import { Bot, MessageCircle, Store, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { openAIChatWithProduct } from "@/components/AIChat";

function getProductName(p: AssistiveProduct, lang: Lang) {
  return lang === "ar" ? p.nameAr : lang === "es" ? p.nameEs : p.nameEn;
}

function getCategoryName(c: typeof assistiveCategories[0], lang: Lang) {
  return lang === "ar" ? c.nameAr : lang === "es" ? c.nameEs : c.nameEn;
}

function getCountryName(c: typeof deliveryCountries[0], lang: Lang) {
  return lang === "ar" ? c.ar : lang === "es" ? c.es : c.en;
}

function getSpecs(p: AssistiveProduct, lang: Lang) {
  return lang === "ar" ? p.specs.ar : lang === "es" ? p.specs.es : p.specs.en;
}

export default function AssistiveProducts() {
  const { t, lang } = useLanguage();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deliveryChoices, setDeliveryChoices] = useState<Record<string, string>>({});

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
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

  const selectedProducts = useMemo(() => {
    return assistiveCategories.flatMap((c) =>
      c.products.filter((p) => selected[p.id])
    );
  }, [selected]);

  const handleWhatsApp = () => {
    if (selectedProducts.length === 0) {
      toast.error(t("vep.noSelection"));
      return;
    }

    const lines = selectedProducts.map((p) => {
      const name = getProductName(p, lang);
      const country = deliveryChoices[p.id]
        ? getCountryName(
            deliveryCountries.find((c) => c.code === deliveryChoices[p.id])!,
            lang
          )
        : t("vep.notSelected");
      return `• ${name} → ${t("vep.deliverTo")}: ${country}`;
    });

    const message = `${t("vep.whatsappIntro")}\n\n${lines.join("\n")}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/96170750609?text=${encoded}`, "_blank");
  };

  const handleAIConsultant = () => {
    if (selectedProducts.length === 0) {
      toast.error(t("vep.noSelection"));
      return;
    }
    toast.info(t("vep.aiLoading"));

    const productNames = selectedProducts.map((p) => getProductName(p, "en")).join(", ");
    const query = encodeURIComponent(`Compare assistive products for visually impaired: ${productNames}. Show features, specifications, prices, and similar alternatives from online stores.`);
    window.open(`https://www.google.com/search?q=${query}`, "_blank");
  };

  return (
    <Layout>
      <section className="px-4 py-12" aria-labelledby="vep-heading">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 id="vep-heading" className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("vep.title")}
            </h1>
            <p className="text-lg text-muted-foreground">{t("vep.subtitle")}</p>
          </div>

          {/* Categories accordion */}
          <Accordion type="multiple" defaultValue={assistiveCategories.map((c) => c.id)} className="space-y-4">
            {assistiveCategories.map((category) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className="rounded-xl border bg-card"
              >
                <AccordionTrigger className="px-5 py-4 text-lg font-bold hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <span className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{category.icon}</span>
                    {getCategoryName(category, lang)}
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {category.products.length}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="grid gap-4">
                    {category.products.map((product) => {
                      const isSelected = !!selected[product.id];
                      return (
                        <Card
                          key={product.id}
                          className={`transition-all ${isSelected ? "ring-2 ring-primary shadow-md" : ""}`}
                        >
                          <CardContent className="p-4 sm:p-5">
                            {/* Product header with checkbox */}
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={`product-${product.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleProduct(product.id)}
                                className="mt-1 h-5 w-5"
                                aria-label={getProductName(product, lang)}
                              />
                              <div className="flex-1 min-w-0">
                                <label
                                  htmlFor={`product-${product.id}`}
                                  className="cursor-pointer text-base font-semibold leading-tight sm:text-lg"
                                >
                                  {getProductName(product, lang)}
                                </label>

                                {/* Stores info */}
                                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span>
                                    {t("vep.storesCount").replace("{count}", String(product.storeCount))}
                                  </span>
                                </div>

                                {/* Specs */}
                                <ul className="mt-2 space-y-1">
                                  {getSpecs(product, lang).map((spec, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                                      {spec}
                                    </li>
                                  ))}
                                </ul>

                                {/* Delivery dropdown - only when selected */}
                                {isSelected && (
                                  <div className="mt-4 max-w-xs">
                                    <label className="mb-1.5 block text-sm font-medium">
                                      {t("vep.deliverTo")}
                                    </label>
                                    <Select
                                      value={deliveryChoices[product.id] || ""}
                                      onValueChange={(val) =>
                                        setDeliveryChoices((prev) => ({ ...prev, [product.id]: val }))
                                      }
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("vep.selectCountry")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {deliveryCountries.map((country) => (
                                          <SelectItem key={country.code} value={country.code}>
                                            {getCountryName(country, lang)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Selected count */}
          {selectedProducts.length > 0 && (
            <p className="mt-6 text-center text-sm font-medium text-primary" aria-live="polite">
              {t("vep.selectedCount").replace("{count}", String(selectedProducts.length))}
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="gap-2 text-base px-6 py-6"
              onClick={handleAIConsultant}
            >
              <Bot className="h-5 w-5" />
              {t("vep.aiConsultant")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-base px-6 py-6"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-5 w-5" />
              {t("vep.contactUs")}
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
