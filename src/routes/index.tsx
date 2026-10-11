import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, QrCode, Search, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard, EventGridSkeleton } from "@/components/event-card";
import { CATEGORIES, CATEGORY_INFO } from "@/lib/events";
import { upcomingEventsQuery } from "@/lib/queries";
import hero from "@/assets/cat-cultural.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusConnect – Discover What's Happening at JNEC" },
      { name: "description", content: "Browse upcoming JNEC club events, check live seat availability and register in seconds." },
      { property: "og:title", content: "CampusConnect – Discover What's Happening at JNEC" },
      { property: "og:description", content: "Browse upcoming JNEC club events, check live seat availability and register in seconds." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data, isLoading, error } = useQuery(upcomingEventsQuery);
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <img src={hero} alt="" className="absolute inset-0 size-full object-cover opacity-25" width={1280} height={720} />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <p className="mb-4 inline-block rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            Jawaharlal Nehru Engineering College
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Discover What's Happening on Campus
          </h1>
          <p className="mt-5 max-w-xl text-lg text-primary-foreground/80">
            Every club event in one place. Find what interests you, see how many seats are left, and get your entry pass in seconds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link to="/events">
                Explore Events <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/my-passes">My passes</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <h2 className="text-2xl font-bold">Browse by category</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link key={c} to="/events" search={{ category: c }} className="card-lift group relative h-40 overflow-hidden rounded-2xl">
              <img src={CATEGORY_INFO[c].image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-primary/10" />
              <div className="absolute bottom-0 p-4 text-primary-foreground">
                <p className="text-lg font-bold">{c}</p>
                <p className="hidden text-xs text-primary-foreground/80 sm:block">{CATEGORY_INFO[c].blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">Upcoming events</h2>
          <Link to="/events" className="text-sm font-semibold text-accent hover:underline">View all →</Link>
        </div>
        <div className="mt-6">
          {isLoading ? (
            <EventGridSkeleton />
          ) : error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">Couldn't load events. Please refresh.</p>
          ) : data && data.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}
            </div>
          ) : (
            <p className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No upcoming events yet — check back soon.</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <h2 className="text-2xl font-bold">How registration works</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            { icon: Search, t: "Find an event", d: "Search or filter by category and check seats left in real time." },
            { icon: Ticket, t: "Register in seconds", d: "Just your name, PRN and department — nothing else." },
            { icon: QrCode, t: "Show your QR pass", d: "Download or print your entry pass. Organisers scan it at the door." },
          ].map((s, i) => (
            <div key={s.t} className="rounded-2xl border bg-card p-6 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-accent"><s.icon className="size-5" /></span>
                <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-bold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
