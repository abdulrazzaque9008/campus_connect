import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { coverFor, fmtDate, fmtTime, registrationState, seatsLeft, type EventRow, type RegState } from "@/lib/events";

export function StatusPill({ state, className }: { state: RegState; className?: string }) {
  const tone = {
    open: "bg-success/15 text-success",
    low: "bg-warning/20 text-warning-foreground",
    full: "bg-destructive/10 text-destructive",
    closed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  }[state.tone];
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone, className)}>{state.label}</span>;
}

export function EventCard({ event }: { event: EventRow }) {
  const state = registrationState(event);
  return (
    <article className="card-lift group flex flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <img
          src={coverFor(event)}
          alt=""
          loading="lazy"
          width={1280}
          height={720}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge className="absolute left-3 top-3 bg-background/90 text-primary hover:bg-background/90">{event.category}</Badge>
        {event.is_sample && (
          <span className="absolute right-3 top-3 rounded-full bg-primary/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            Sample
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{event.club_name}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-snug">{event.title}</h3>
          {event.short_description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{event.short_description}</p>
          )}
        </div>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0" /> {fmtDate(event.event_date)} · {fmtTime(event.start_time)}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" /> <span className="truncate">{event.venue}</span>
          </li>
          <li className="flex items-center gap-2">
            <Users className="size-4 shrink-0" /> {seatsLeft(event)} of {event.capacity} seats available
          </li>
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <StatusPill state={state} />
          <Button asChild size="sm" variant={state.open ? "default" : "outline"}>
            <Link to="/events/$eventId" params={{ eventId: event.id }}>
              {state.open ? "Register now" : "View details"}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function EventGridSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-96 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}
