import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, ShoppingBag, BookOpen, Sparkles } from "lucide-react";

const features = [
  {
    icon: ShoppingBag,
    title: "Marketplace",
    desc: "Discover products and services curated for accessibility.",
    to: "/marketplace",
  },
  {
    icon: Eye,
    title: "Services",
    desc: "Professional services designed to be inclusive from the start.",
    to: "/services",
  },
  {
    icon: BookOpen,
    title: "Content",
    desc: "Articles, guides, and resources for everyone.",
    to: "/content",
  },
];

export default function Index() {
  return (
    <Layout>
      {/* Hero */}
      <section className="px-4 py-20 text-center" aria-labelledby="hero-heading">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span className="text-base font-semibold">Accessible by design</span>
          </div>
          <h1
            id="hero-heading"
            className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          >
            A platform built for{" "}
            <span className="text-primary">everyone</span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            Visionex brings together marketplace, services, and content — all with
            high contrast, large fonts, and keyboard-first navigation.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8 py-6 font-semibold">
                Get started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                Explore Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/50 px-4 py-16" aria-labelledby="features-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="features-heading" className="mb-10 text-center text-3xl font-bold">
            Everything in one place
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <Link to={f.to} key={f.title} className="group">
                <Card className="h-full transition-shadow hover:shadow-lg group-focus-visible:ring-4 group-focus-visible:ring-ring">
                  <CardContent className="flex flex-col items-start gap-4 p-8">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <f.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-bold">{f.title}</h3>
                    <p className="text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Points CTA */}
      <section className="px-4 py-16 text-center" aria-labelledby="points-heading">
        <div className="mx-auto max-w-2xl">
          <h2 id="points-heading" className="mb-4 text-3xl font-bold">
            Earn points as you go
          </h2>
          <p className="mb-6 text-lg text-muted-foreground">
            Every activity earns you points — sign up to get 100 welcome points instantly.
            Track your balance in your dashboard.
          </p>
          <Link to="/signup">
            <Button size="lg" className="text-lg px-8 py-6 font-semibold">
              Claim your 100 points
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
