import { Layout } from "@/components/Layout";
import { ShoppingBag } from "lucide-react";

const points = [
  "Visionex acts as a platform facilitating connections between buyers and sellers and does not manufacture, store, or guarantee third-party products.",
  "Sellers are responsible for ensuring that their product listings are accurate, legal, and compliant with applicable consumer protection laws.",
  "Prohibited products include illegal goods, counterfeit products, stolen items, and products that violate intellectual property rights.",
  "Visionex may remove listings or suspend stores that violate platform policies.",
];

export default function MarketplacePolicy() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShoppingBag className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Marketplace Policy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visionex Platform · Last Updated: 2026</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <p className="mb-6 leading-relaxed text-muted-foreground">
            Visionex provides marketplace tools allowing users to create digital storefronts and offer
            products or services.
          </p>
          <ul className="space-y-4">
            {points.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <p className="leading-relaxed text-muted-foreground">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Layout>
  );
}
