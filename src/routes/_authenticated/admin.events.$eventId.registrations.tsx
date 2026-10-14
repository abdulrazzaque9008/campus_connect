import { createFileRoute } from "@tanstack/react-router";
import { RegistrationsView } from "@/components/registrations-view";

export const Route = createFileRoute("/_authenticated/admin/events/$eventId/registrations")({
  component: EventRegistrations,
});

function EventRegistrations() {
  const { eventId } = Route.useParams();
  return <RegistrationsView key={eventId} eventId={eventId} />;
}
