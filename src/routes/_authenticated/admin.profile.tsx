import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, fmtDate, fmtDateTime, friendlyError } from "@/lib/events";
import { allEventsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  component: Profile,
});

function Profile() {
  // `user` comes from Supabase Auth (verified session), never from editable form values.
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const stats = useQuery({
    queryKey: ["profile", user.id, "stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_organiser_stats");
      if (error) throw error;
      return data[0];
    },
  });
  const events = useQuery(allEventsQuery);
  const mine = (events.data ?? []).filter((e) => e.created_by === user.id);

  const [name, setName] = useState("");
  useEffect(() => setName(profile.data?.full_name ?? ""), [profile.data?.full_name]);
  const save = useMutation({
    mutationFn: async (n: string) => {
      const { data, error } = await supabase.rpc("update_my_profile", { _full_name: n });
      if (error) throw error;
      return data;
    },
    onSuccess: (saved) => {
      setName(saved);
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["admin", "organisers"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const n = name.trim().replace(/\s+/g, " ");
  const nameError = n.length < 2 || n.length > 100 ? "Name must be 2–100 characters." : "";
  const s = stats.data;
  const cards: [string, number | undefined][] = [
    ["Events created", s?.events_created],
    ["Events managed", s?.events_managed],
    ["Upcoming", s?.upcoming],
    ["Completed", s?.completed],
    ["Cancelled", s?.cancelled],
    ["Registrations", s?.registrations],
    ["Checked in", s?.checked_in],
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-accent">
          <UserRound className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-extrabold">
            {profile.data?.full_name || "Your profile"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{user.email}</span>
            <Badge>Organiser</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!nameError) save.mutate(n);
          }}
        >
          <h2 className="font-bold">Account</h2>
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              disabled={profile.isLoading}
              aria-invalid={(!!nameError && name !== "") || undefined}
              aria-describedby="full-name-hint"
            />
            <p
              id="full-name-hint"
              className={`text-xs ${nameError && name ? "text-destructive" : "text-muted-foreground"}`}
            >
              {nameError && name ? nameError : "Shown to other organisers on the Team page."}
            </p>
          </div>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">Organiser</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">
                {user.created_at ? fmtDateTime(user.created_at) : "—"}
              </dd>
            </div>
          </dl>
          {profile.error && (
            <p className="text-sm text-destructive">
              Couldn't load your profile: {friendlyError(profile.error)}
            </p>
          )}
          <Button
            type="submit"
            disabled={save.isPending || !!nameError || n === (profile.data?.full_name ?? "").trim()}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
          </Button>
        </form>

        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <h2 className="font-bold">Your activity</h2>
          {stats.error ? (
            <p className="mt-4 text-sm text-destructive">
              Couldn't load your statistics: {friendlyError(stats.error)}
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {cards.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-2xl font-extrabold">
                    {stats.isLoading ? "…" : Number(value ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}
          {!!s?.past_unclosed && (
            <p className="mt-3 text-xs text-muted-foreground">
              {Number(s.past_unclosed)} past event{Number(s.past_unclosed) === 1 ? " is" : "s are"}{" "}
              still open — mark {Number(s.past_unclosed) === 1 ? "it" : "them"} completed from the
              dashboard.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold">Events you created</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border bg-card shadow-card">
          {events.isLoading ? (
            <div className="h-24 animate-pulse bg-muted" />
          ) : events.error ? (
            <p className="p-6 text-destructive">Couldn't load events.</p>
          ) : !mine.length ? (
            <div className="p-10 text-center text-muted-foreground">
              You haven't created any events yet.{" "}
              <Button asChild variant="link">
                <Link to="/admin/events/new">Create your first event</Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Event</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Seats</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Registrations</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3 font-semibold">{e.title}</td>
                    <td className="whitespace-nowrap p-3">{fmtDate(e.event_date)}</td>
                    <td className="whitespace-nowrap p-3">
                      {e.confirmed_count}/{e.capacity}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          e.status === "cancelled"
                            ? "destructive"
                            : e.status === "completed"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {STATUS_LABEL[e.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/events/$eventId/registrations" params={{ eventId: e.id }}>
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
