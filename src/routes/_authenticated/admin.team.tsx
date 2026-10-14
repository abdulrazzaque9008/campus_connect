import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/admin/team")({
  component: Team,
});

function Team() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "organisers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_organisers");
      if (error) throw error;
      return data;
    },
  });
  const grant = useMutation({
    mutationFn: async (e: string) => {
      const { error } = await supabase.rpc("grant_organiser", { _email: e });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${email.trim()} is now an organiser`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "organisers"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_organiser", { _user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organiser access removed");
      qc.invalidateQueries({ queryKey: ["admin", "organisers"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    grant.mutate(email.trim());
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold">Organiser team</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Organisers can create and edit events, see registrations (including PRNs) and check students in. Ask a new
        organiser to create an account on the login page and confirm their email, then add them here.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-2 rounded-2xl border bg-card p-6 shadow-card" noValidate>
        <Label htmlFor="org-email">Grant organiser access</Label>
        <div className="flex gap-2">
          <Input
            id="org-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@college.edu"
            autoComplete="off"
          />
          <Button type="submit" disabled={grant.isPending || !email.trim()}>
            {grant.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add
          </Button>
        </div>
      </form>
      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-card">
        {isLoading ? (
          <div className="h-32 animate-pulse bg-muted" />
        ) : error ? (
          <p className="p-6 text-destructive">Couldn't load organisers: {friendlyError(error)}</p>
        ) : (
          <ul>
            {data?.map((o) => (
              <li key={o.user_id} className="flex items-center justify-between gap-4 border-t p-4 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.full_name || o.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{o.email}</p>
                </div>
                {o.user_id === user.id ? (
                  <span className="text-xs font-semibold text-muted-foreground">You</span>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={revoke.isPending}>
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove organiser access for {o.email}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Their account stays, but they will no longer be able to manage events, view registrations
                          or check students in.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep access</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => revoke.mutate(o.user_id)}
                        >
                          Remove access
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
