import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventForm } from "@/components/event-form";
import { isUuid } from "@/lib/events";
import { eventQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/events/$eventId/edit")({
  component: EditEvent,
});

function EditEvent() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const valid = isUuid(eventId);
  const { data, isLoading, error } = useQuery({ ...eventQuery(eventId), enabled: valid });
  if (valid && isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  if (error) return <p className="text-destructive">Couldn't load this event. Please refresh.</p>;
  if (!valid || !data)
    return (
      <div className="rounded-2xl border bg-card p-10 text-center">
        <p className="font-semibold">Event not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin">Back to dashboard</Link>
        </Button>
      </div>
    );
  return (
    <div className="max-w-3xl">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-extrabold">Edit event</h1>
      {data.status !== "published" ? (
        <div className="rounded-2xl border bg-card p-8">
          <Lock className="size-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">This event is {data.status} and can no longer be edited.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Locking finished and cancelled events keeps every issued entry pass consistent. Registrations remain
            available for your records.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/admin/events/$eventId/registrations" params={{ eventId }}>
              View registrations
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {data.confirmed_count > 0 && (
            <p className="mb-4 rounded-xl bg-secondary px-4 py-3 text-sm">
              {data.confirmed_count} student{data.confirmed_count > 1 ? "s have" : " has"} already registered. Their
              passes stay valid and will show the updated details.
            </p>
          )}
          <EventForm
            initial={data}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["events"] });
              navigate({ to: "/admin" });
            }}
          />
        </>
      )}
    </div>
  );
}
