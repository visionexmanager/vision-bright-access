import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Search, Filter, ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";

interface Subscriber {
  id: string;
  email: string;
  topics: string[];
  subscribed_at: string;
}

const ALL_TOPICS = ["products", "services", "courses", "games", "tech-news", "global-news"];

export default function AdminSubscribers() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("subscribed_at", { ascending: false });
      setSubscribers((data as Subscriber[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = subscribers.filter((s) => {
    const matchesSearch = !search || s.email.toLowerCase().includes(search.toLowerCase());
    const matchesTopic = !activeTopic || s.topics.includes(activeTopic);
    return matchesSearch && matchesTopic;
  });

  const topicCounts = ALL_TOPICS.map((t) => ({
    topic: t,
    count: subscribers.filter((s) => s.topics.includes(t)).length,
  }));

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <Mail className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Newsletter Subscribers</h1>
          <Badge variant="secondary" className="text-sm">{subscribers.length} total</Badge>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
            const header = "Email,Topics,Subscribed At\n";
            const rows = filtered.map(s => `"${s.email}","${s.topics.join("; ")}","${new Date(s.subscribed_at).toLocaleDateString()}"`).join("\n");
            const blob = new Blob([header + rows], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "subscribers.csv"; a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Topic filter chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeTopic === null ? "default" : "outline"}
            onClick={() => setActiveTopic(null)}
          >
            <Filter className="mr-1 h-3.5 w-3.5" /> All
          </Button>
          {topicCounts.map(({ topic, count }) => (
            <Button
              key={topic}
              size="sm"
              variant={activeTopic === topic ? "default" : "outline"}
              onClick={() => setActiveTopic(activeTopic === topic ? null : topic)}
            >
              {topic} ({count})
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} subscriber{filtered.length !== 1 ? "s" : ""}
              {activeTopic && ` interested in "${activeTopic}"`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-center text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">No subscribers found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead>Subscribed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.topics.map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(s.subscribed_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
