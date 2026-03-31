import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, Eye, Users, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

type AnalyticsData = {
  stats: {
    totalPageViews: number;
    uniqueSessions: number;
    topPages: { path: string; views: number }[];
    eventBreakdown: Record<string, number>;
    totalProducts: number;
    totalContent: number;
  };
  insights: string;
};

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("analytics-insights");
      if (error) throw error;
      setData(result as AnalyticsData);
    } catch (e: any) {
      toast.error(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <h1 className="text-3xl font-bold">Analytics & Insights</h1>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`me-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Page Views (30d)</CardTitle>
                  <Eye className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent><p className="text-3xl font-bold">{data.stats.totalPageViews}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Unique Sessions</CardTitle>
                  <Users className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent><p className="text-3xl font-bold">{data.stats.uniqueSessions}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Products</CardTitle>
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent><p className="text-3xl font-bold">{data.stats.totalProducts}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Content Items</CardTitle>
                  <BarChart3 className="h-5 w-5 text-orange-500" />
                </CardHeader>
                <CardContent><p className="text-3xl font-bold">{data.stats.totalContent}</p></CardContent>
              </Card>
            </div>

            {/* Top pages */}
            <Card>
              <CardHeader><CardTitle>Top Pages</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.stats.topPages.map((page, i) => (
                    <div key={page.path} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                        <span className="font-mono text-sm">{page.path}</span>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">{page.views} views</span>
                    </div>
                  ))}
                  {data.stats.topPages.length === 0 && (
                    <p className="text-muted-foreground">No page view data yet. Data will appear as users visit pages.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader><CardTitle>AI-Generated Insights</CardTitle></CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{data.insights}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-muted-foreground">Failed to load analytics data.</p>
        )}
      </section>
    </Layout>
  );
}
