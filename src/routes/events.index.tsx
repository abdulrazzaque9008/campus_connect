import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EventCard, EventGridSkeleton } from "@/components/event-card";
import { CATEGORIES, type Category } from "@/lib/events";
import { upcomingEventsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Search = { q?: string | undefined; category?: Category | undefined };

export const Route = createFileRoute("/events/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    category: CATEGORIES.includes(s["category"] as Category) ? (s["category"] as Category) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Explore Events – CampusConnect" },
      { name: "description", content: "Search and filter every upcoming club event at JNEC." },
      { property: "og:title", content: "Explore Events – CampusConnect" },
      { property: "og:description", content: "Search and filter every upcoming club event at JNEC." },
    ],
  }),
  component: Explore,
});

const PAGE = 9;

function Explore() {
  const { q = "", category } = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const { data, isLoading, error, refetch } = useQuery(upcomingEventsQuery);
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter(
      (e) =>
        (!category || e.category === category) &&
        (!term || e.title.toLowerCase().includes(term) || e.club_name.toLowerCase().includes(term)),
    );
  }, [data, q, category]);

  const set = (patch: Search) => {
    setLimit(PAGE);
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold">Explore events</h1>
      <p className="mt-2 text-muted-foreground">All upcoming events, soonest first.</p>

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder="Search by event or club name"
            className="h-11 pl-9"
            aria-label="Search events"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[undefined, ...CATEGORIES].map((c) => (
            <button
              key={c ?? "all"}
              onClick={() => set({ category: c })}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
              )}
            >
              {c ?? "All"}
            </button>
          ))}
          {(q || category) && (
            <Button variant="ghost" onClick={() => set({ q: undefined, category: undefined })}>
              <X /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <EventGridSkeleton n={6} />
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            Couldn't load events. <Button variant="link" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <p className="text-lg font-semibold">No events match your filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search term or category.</p>
            <Button className="mt-4" variant="outline" onClick={() => set({ q: undefined, category: undefined })}>Clear filters</Button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{filtered.length} event{filtered.length > 1 ? "s" : ""}</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, limit).map((e) => <EventCard key={e.id} event={e} />)}
            </div>
            {filtered.length > limit && (
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={() => setLimit(limit + PAGE)}>Load more</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
