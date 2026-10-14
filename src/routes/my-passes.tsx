import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Calendar, Loader2, MapPin, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  fmtDate,
  parsePassToken,
  removePassToken,
  savePassToken,
  savedPassTokens,
} from "@/lib/events";

export const Route = createFileRoute("/my-passes")({
  head: () => ({
    meta: [
      { title: "My Passes – CampusConnect" },
      {
        name: "description",
        content: "Entry passes for events you registered for on this device.",
      },
      { property: "og:title", content: "My Passes – CampusConnect" },
      {
        property: "og:description",
        content: "Entry passes for events you registered for on this device.",
      },
    ],
  }),
  component: MyPasses,
});

async function loadPass(token: string) {
  const { data, error } = await supabase.rpc("get_pass", { _token: token });
  if (error) throw error;
  return data?.[0] ?? null;
}

function MyPasses() {
  const [tokens, setTokens] = useState<string[] | null>(null);
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [linkError, setLinkError] = useState("");
  useEffect(() => setTokens(savedPassTokens()), []);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["passes", tokens],
    enabled: !!tokens?.length,
    queryFn: async () =>
      Promise.all(tokens!.map(async (t) => ({ token: t, pass: await loadPass(t) }))),
  });

  async function addPass(e: React.FormEvent) {
    e.preventDefault();
    const token = parsePassToken(link);
    if (!token) {
      setLinkError("Paste the full pass link (it contains /pass/ or /verify/).");
      return;
    }
    setAdding(true);
    try {
      const pass = await loadPass(token);
      if (!pass) {
        setLinkError("We couldn't find a pass for that link.");
        return;
      }
      if (!savePassToken(token))
        toast.warning("This browser won't let us save passes, but the link still works.");
      else toast.success(`Added your pass for ${pass.event_title}`);
      setLink("");
      setLinkError("");
      setTokens(savedPassTokens());
    } catch {
      setLinkError("Couldn't check that link — please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">My passes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Passes for events you registered for on this device, kept in this browser. For privacy,
        passes can't be looked up by PRN — keep your pass link safe (use "Copy pass link" on a
        pass).
      </p>
      <div className="mt-8 space-y-3">
        {tokens === null || (isLoading && tokens.length) ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : !tokens.length ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <Ticket className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No passes on this device yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Register for an event, or add a pass below using its link.
            </p>
            <Button asChild className="mt-4">
              <Link to="/events">Find an event</Link>
            </Button>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            Couldn't load your passes.{" "}
            <Button variant="link" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          data?.map(({ token, pass }) => (
            <div
              key={token}
              className="card-lift flex items-center justify-between gap-4 rounded-2xl border bg-card p-5"
            >
              {pass ? (
                <Link to="/pass/$token" params={{ token }} className="min-w-0 flex-1">
                  <p className="truncate font-bold">{pass.event_title}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {fmtDate(pass.event_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {pass.venue}
                    </span>
                  </p>
                  <p className="mt-1 text-xs">
                    <span className="font-mono">{pass.registration_code}</span> ·{" "}
                    <span
                      className={
                        pass.status === "confirmed" && pass.event_status !== "cancelled"
                          ? "text-success"
                          : "text-destructive"
                      }
                    >
                      {pass.event_status === "cancelled"
                        ? "Event cancelled"
                        : pass.status === "confirmed" && pass.checked_in_at
                          ? "Checked in"
                          : pass.status}
                    </span>
                  </p>
                </Link>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-muted-foreground">Pass unavailable</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This pass no longer exists. You can remove it.
                  </p>
                </div>
              )}
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

      <form onSubmit={addPass} className="mt-10 rounded-2xl border bg-card p-6" noValidate>
        <Label htmlFor="pass-link" className="font-semibold">
          Add a pass to this device
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Registered on another phone or cleared your browser? Paste the pass link you saved.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            id="pass-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…/pass/…"
            autoComplete="off"
            aria-invalid={!!linkError || undefined}
            aria-describedby={linkError ? "pass-link-error" : undefined}
          />
          <Button type="submit" disabled={!link.trim() || adding}>
            {adding ? <Loader2 className="animate-spin" /> : <Plus />} Add
          </Button>
        </div>
        {linkError && (
          <p id="pass-link-error" className="mt-2 text-sm text-destructive">
            {linkError}
          </p>
        )}
      </form>
    </div>
  );
}
