import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Calendar, MapPin, Ticket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, removePassToken, savedPassTokens } from "@/lib/events";

export const Route = createFileRoute("/my-passes")({
  head: () => ({
    meta: [
      { title: "My Passes – CampusConnect" },
      { name: "description", content: "Entry passes for events you registered for on this device." },
      { property: "og:title", content: "My Passes – CampusConnect" },
      { property: "og:description", content: "Entry passes for events you registered for on this device." },
    ],
  }),
  component: MyPasses,
});

function MyPasses() {
  const [tokens, setTokens] = useState<string[] | null>(null);
  useEffect(() => setTokens(savedPassTokens()), []);
  const { data, isLoading } = useQuery({
    queryKey: ["passes", tokens],
    enabled: !!tokens?.length,
    queryFn: async () =>
      Promise.all(
        tokens!.map(async (t) => {
          const { data } = await supabase.rpc("get_pass", { _token: t });
          return { token: t, pass: data?.[0] ?? null };
        }),
      ),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">My passes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Passes for events you registered for on this device. For privacy, passes can't be looked up by PRN — keep the pass link safe.
      </p>
      <div className="mt-8 space-y-3">
        {tokens === null || (isLoading && tokens.length) ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : !tokens.length ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <Ticket className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No passes yet</p>
            <Button asChild className="mt-4"><Link to="/events">Find an event</Link></Button>
          </div>
        ) : (
          data?.filter((d) => d.pass).map(({ token, pass }) => (
            <div key={token} className="card-lift flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
              <Link to="/pass/$token" params={{ token }} className="min-w-0 flex-1">
                <p className="truncate font-bold">{pass!.event_title}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="size-3.5" />{fmtDate(pass!.event_date)}</span>
                  <span className="flex items-center gap-1"><MapPin className="size-3.5" />{pass!.venue}</span>
                </p>
                <p className="mt-1 text-xs">
                  <span className="font-mono">{pass!.registration_code}</span> ·{" "}
                  <span className={pass!.status === "confirmed" && pass!.event_status !== "cancelled" ? "text-success" : "text-destructive"}>
                    {pass!.event_status === "cancelled" ? "Event cancelled" : pass!.status}
                  </span>
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove from this device"
                onClick={() => {
                  removePassToken(token);
                  setTokens(savedPassTokens());
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
