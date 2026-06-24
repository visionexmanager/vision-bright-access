import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type ServiceRequest = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  service_type: string;
  message: string;
  status: string;
  created_at: string;
};

export default function AdminRequests() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("service_requests").select("*").order("created_at", { ascending: false });
      if (data) setRequests(data as ServiceRequest[]);
    };
    load();
  }, []);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Back to admin"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <h1 className="text-3xl font-bold">{t("admin.requests.title")}</h1>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.requests.name")}</TableHead>
                  <TableHead>{t("admin.requests.email")}</TableHead>
                  <TableHead>{t("admin.requests.service")}</TableHead>
                  <TableHead>{t("admin.requests.message")}</TableHead>
                  <TableHead>{t("admin.requests.status")}</TableHead>
                  <TableHead>{t("admin.requests.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.service_type}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.message}</TableCell>
                    <TableCell><Badge variant={r.status === "pending" ? "secondary" : "default"}>{r.status}</Badge></TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
