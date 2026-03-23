import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart, Product } from "@/contexts/CartContext";
import { products, categories, Category } from "@/data/products";
import { CartDrawer } from "@/components/CartDrawer";
import { ShoppingCart, Search, Star, Check, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

type SortOption = "default" | "price-asc" | "price-desc" | "rating-desc" | "points-desc" | "points-asc";

function ProductCard({ product }: { product: Product }) {
  const { addToCart, items } = useCart();
  const inCart = items.some((i) => i.product.id === product.id);

  const handleAdd = () => {
    addToCart(product);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-lg">
      <CardContent className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl">
            {product.image}
          </div>
          <Badge variant="secondary" className="text-sm">
            {product.category}
          </Badge>
        </div>

        <h2 className="text-xl font-bold leading-tight">{product.name}</h2>
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
          <span className="font-medium">{product.rating}</span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
            <p className="text-sm font-medium text-primary">+{product.points} pts</p>
          </div>
          <Button
            onClick={handleAdd}
            disabled={!product.inStock}
            size="lg"
            className="text-base"
            aria-label={
              !product.inStock
                ? `${product.name} is out of stock`
                : inCart
                ? `Add another ${product.name} to cart`
                : `Add ${product.name} to cart`
            }
          >
            {!product.inStock ? (
              "Out of stock"
            ) : inCart ? (
              <>
                <Check className="mr-1 h-4 w-4" /> Add more
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1 h-4 w-4" /> Add to cart
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Marketplace() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) => {
    const matchCategory = activeCategory === "All" || p.category === activeCategory;
    const matchSearch =
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="marketplace-heading">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="marketplace-heading" className="text-3xl font-bold">
              Marketplace
            </h1>
            <p className="text-lg text-muted-foreground">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""} available
            </p>
          </div>
          <CartDrawer />
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 pl-12 text-base"
            aria-label="Search products"
          />
        </div>

        {/* Category filters */}
        <div
          className="mb-8 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter by category"
        >
          {categories.map((cat) => (
            <Button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              variant={activeCategory === cat ? "default" : "outline"}
              onClick={() => setActiveCategory(cat)}
              className="text-base"
            >
              {cat}
              {cat !== "All" && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {products.filter((p) => p.category === cat).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-xl text-muted-foreground">
              No products found. Try a different search or category.
            </p>
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
      </section>
    </Layout>
  );
}
