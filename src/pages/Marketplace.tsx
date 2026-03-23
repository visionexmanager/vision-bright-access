import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCart, Product } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  generalProducts,
  accessibilityProducts,
  generalCategories,
  accessibilityCategories,
} from "@/data/products";
import { CartDrawer } from "@/components/CartDrawer";
import { ProductCard } from "@/components/ProductCard";
import { Search, Eye, Package, HelpCircle, Send } from "lucide-react";
import { toast } from "sonner";

function StoreSection({
  products,
  categories,
}: {
  products: Product[];
  categories: readonly string[];
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const { t } = useLanguage();

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = activeCategory === "All" || p.category === activeCategory;
      const matchSearch =
        search === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, activeCategory, search]);

  return (
    <div>
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder={t("market.searchProducts")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 ps-12 text-base"
            aria-label={t("market.searchLabel")}
          />
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label={t("market.searchLabel")}>
        {categories.map((cat) => (
          <Button
            key={cat}
            role="tab"
            aria-selected={activeCategory === cat}
            variant={activeCategory === cat ? "default" : "outline"}
            onClick={() => setActiveCategory(cat)}
            className="text-base"
          >
            {t(`cat.${cat}`)}
            {cat !== "All" && (
              <Badge variant="secondary" className="ms-2 text-xs">
                {products.filter((p) => p.category === cat).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <p className="mb-4 text-lg text-muted-foreground">
        {t("market.productsFound")
          .replace("{count}", String(filtered.length))
          .replace("{s}", filtered.length !== 1 ? "s" : "")}
      </p>

      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-xl text-muted-foreground">{t("market.noProducts")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {filtered.map((product) => (
            <div key={product.id} role="listitem">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FindItForMe() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast.error(t("find.fillBoth"));
      return;
    }
    setSubmitted(true);
    toast.success(t("find.submitted"));
  };

  if (submitted) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
            ✅
          </div>
          <h3 className="text-2xl font-bold">{t("find.received")}</h3>
          <p className="text-lg text-muted-foreground">{t("find.receivedDesc")}</p>
          <Button
            onClick={() => { setSubmitted(false); setName(""); setDescription(""); }}
            variant="outline"
            size="lg"
            className="mt-4 text-base"
          >
            {t("find.submitAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold">{t("find.title")}</h3>
            <p className="text-muted-foreground">{t("find.subtitle")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="product-name" className="mb-2 block text-base font-semibold">{t("find.productName")}</label>
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("find.productNamePlaceholder")} className="h-12 text-base" required />
          </div>
          <div>
            <label htmlFor="product-desc" className="mb-2 block text-base font-semibold">{t("find.description")}</label>
            <Textarea id="product-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("find.descriptionPlaceholder")} className="min-h-[120px] text-base" required />
          </div>
          <Button type="submit" size="lg" className="mt-2 text-base">
            <Send className="me-2 h-5 w-5" />
            {t("find.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Marketplace() {
  const { t } = useLanguage();

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="marketplace-heading">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="marketplace-heading" className="text-3xl font-bold">{t("market.title")}</h1>
            <p className="text-lg text-muted-foreground">{t("market.subtitle")}</p>
          </div>
          <CartDrawer />
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-8 grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="general" className="flex items-center gap-2 py-3 text-base">
              <Package className="h-5 w-5" />
              <span>{t("market.generalStore")}</span>
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-2 py-3 text-base">
              <Eye className="h-5 w-5" />
              <span>{t("market.accessibilityStore")}</span>
            </TabsTrigger>
            <TabsTrigger value="find" className="flex items-center gap-2 py-3 text-base">
              <HelpCircle className="h-5 w-5" />
              <span>{t("market.findItForMe")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <StoreSection products={generalProducts} categories={generalCategories} />
          </TabsContent>
          <TabsContent value="accessibility">
            <StoreSection products={accessibilityProducts} categories={accessibilityCategories} />
          </TabsContent>
          <TabsContent value="find">
            <FindItForMe />
          </TabsContent>
        </Tabs>
      </section>
    </Layout>
  );
}
