import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type UserProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  isAdmin?: boolean;
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    
    const adminIds = new Set((roles ?? []).filter(r => r.role === "admin").map(r => r.user_id));
    
    setUsers((profiles ?? []).map(p => ({
      ...p,
      isAdmin: adminIds.has(p.user_id),
    })));
  };

  useEffect(() => { load(); }, []);

  const toggleAdmin = async (profile: UserProfile) => {
    if (profile.user_id === currentUser?.id) {
      toast.error("You cannot remove your own admin role");
      return;
    }

    if (profile.isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", profile.user_id).eq("role", "admin");
      if (error) toast.error(error.message);
      else toast.success("Admin role removed");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: profile.user_id, role: "admin" });
      if (error) toast.error(error.message);
      else toast.success("Admin role granted");
    }
    load();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-3xl font-bold">Manage Users</h1>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{u.user_id}</TableCell>
                    <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {u.isAdmin ? <Badge className="bg-primary">Admin</Badge> : <Badge variant="secondary">User</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={u.isAdmin ? "destructive" : "default"}
                        size="sm"
                        onClick={() => toggleAdmin(u)}
                        disabled={u.user_id === currentUser?.id}
                      >
                        {u.isAdmin ? <><ShieldOff className="me-1 h-4 w-4" /> Remove Admin</> : <><ShieldCheck className="me-1 h-4 w-4" /> Make Admin</>}
                      </Button>
                    </TableCell>
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
