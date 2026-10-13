import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { EventForm } from "@/components/event-form";

export const Route = createFileRoute("/_authenticated/admin/events/new")({
  component: NewEvent,
});

function NewEvent() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-extrabold">Create event</h1>
      <EventForm
        onSaved={(id) => {
          qc.invalidateQueries({ queryKey: ["events"] });
          navigate({ to: "/events/$eventId", params: { eventId: id } });
        }}
      />
    </div>
  );
}
