import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EventForm } from "@/components/event-form";
import { eventQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/events/$eventId/edit")({
  component: EditEvent,
});

function EditEvent() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(eventQuery(eventId));
  if (isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  if (!data) return <p>Event not found.</p>;
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-extrabold">Edit event</h1>
      <EventForm
        initial={data}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["events"] });
          navigate({ to: "/admin" });
        }}
      />
    </div>
  );
}
