import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "lucide-react";

const items = [
  { name: "Screen Reader Pro", category: "Software", points: 50 },
  { name: "Accessible Theme Pack", category: "Design", points: 30 },
  { name: "Voice Control Kit", category: "Hardware", points: 80 },
  { name: "Braille Display Adapter", category: "Hardware", points: 120 },
  { name: "High Contrast Templates", category: "Design", points: 25 },
  { name: "Audio Description Tools", category: "Media", points: 40 },
];

export default function Marketplace() {
  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10" aria-labelledby="marketplace-heading">
        <h1 id="marketplace-heading" className="mb-2 text-3xl font-bold">Marketplace</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Browse accessible products and tools. Earn points to unlock rewards.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.name} className="transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="rounded-xl bg-primary/10 p-3 w-fit">
                  <ShoppingBag className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-bold">{item.name}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.category}</Badge>
                  <Badge className="text-sm">{item.points} pts</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Layout>
  );
}
