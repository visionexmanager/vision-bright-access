import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { usePoints } from "@/hooks/usePoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigate } from "react-router-dom";
import { Star, TrendingUp, Gift } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { totalPoints, history, loadingTotal, loadingHistory } = usePoints();

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold">Dashboard</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Welcome back, {user.user_metadata?.display_name || user.email}
        </p>

        {/* Points cards */}
        <div className="mb-10 grid gap-6 sm:grid-cols-3">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <Star className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Points</p>
                {loadingTotal ? (
                  <Skeleton className="mt-1 h-8 w-20" />
                ) : (
                  <p className="text-3xl font-bold text-primary" aria-live="polite">
                    {totalPoints.toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-accent/10 p-3">
                <TrendingUp className="h-8 w-8 text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Activities</p>
                <p className="text-3xl font-bold">{history.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <Gift className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rank</p>
                <p className="text-3xl font-bold">
                  {totalPoints >= 500 ? "Gold" : totalPoints >= 200 ? "Silver" : "Bronze"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Points history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Points History</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No activity yet. Start exploring to earn points!
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-base">Activity</TableHead>
                    <TableHead className="text-base">Points</TableHead>
                    <TableHead className="text-base">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-base font-medium">
                        {entry.reason}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.points > 0 ? "default" : "destructive"}
                          className="text-sm"
                        >
                          {entry.points > 0 ? "+" : ""}
                          {entry.points}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-base text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
