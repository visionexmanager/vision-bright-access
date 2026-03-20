import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

const services = [
  { name: "Accessibility Audit", desc: "Full website accessibility review", points: 75 },
  { name: "WCAG Compliance Check", desc: "Ensure your product meets WCAG 2.1 AA", points: 60 },
  { name: "User Testing", desc: "Testing with users who have diverse abilities", points: 100 },
  { name: "Remediation Support", desc: "Fix accessibility issues with expert guidance", points: 90 },
];

export default function Services() {
  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10" aria-labelledby="services-heading">
        <h1 id="services-heading" className="mb-2 text-3xl font-bold">Services</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Professional accessibility services — earn points for each engagement.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {services.map((s) => (
            <Card key={s.name} className="transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-col gap-4 p-8">
                <div className="rounded-xl bg-primary/10 p-3 w-fit">
                  <Eye className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-bold">{s.name}</h2>
                <p className="text-muted-foreground">{s.desc}</p>
                <Badge className="w-fit text-sm">Earn {s.points} pts</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Layout>
  );
}
