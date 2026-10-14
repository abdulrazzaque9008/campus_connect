import { createFileRoute } from "@tanstack/react-router";
import { RegistrationsView } from "@/components/registrations-view";

export const Route = createFileRoute("/_authenticated/admin/registrations")({
  component: () => <RegistrationsView eventId={null} />,
});
