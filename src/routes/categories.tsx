import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIES, CATEGORY_INFO } from "@/lib/events";
import { upcomingEventsQuery } from "@/lib/queries";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Event Categories – CampusConnect" },
      { name: "description", content: "Technical, cultural, sports and workshop events at JNEC." },
      { property: "og:title", content: "Event Categories – CampusConnect" },
      {
        property: "og:description",
        content: "Technical, cultural, sports and workshop events at JNEC.",
      },
    ],
  }),
  component: Categories,
});

function Categories() {
  const { data } = useQuery(upcomingEventsQuery);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold">Categories</h1>
      <p className="mt-2 text-muted-foreground">Pick what you're into.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {CATEGORIES.map((c) => {
          const n = data?.filter((e) => e.category === c).length;
          return (
            <Link
              key={c}
              to="/events"
              search={{ category: c }}
              className="card-lift group relative h-56 overflow-hidden rounded-2xl"
            >
              <img
                src={CATEGORY_INFO[c].image}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-primary/10" />
              <div className="absolute bottom-0 p-6 text-primary-foreground">
                <p className="text-2xl font-bold">{c}</p>
                <p className="text-sm text-primary-foreground/80">{CATEGORY_INFO[c].blurb}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide">
                  {n ?? "…"} upcoming
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
