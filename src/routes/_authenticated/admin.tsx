import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", {
      _user_id: context.user.id,
      _role: "organiser",
    });
    return { isOrganiser: !!data };
  },
  head: () => ({
    meta: [
      { title: "Organiser Dashboard – CampusConnect" },
      { name: "description", content: "Manage events, registrations and entry passes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Organiser Dashboard – CampusConnect" },
      { property: "og:description", content: "Manage events, registrations and entry passes." },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isOrganiser, user } = Route.useRouteContext();
  if (!isOrganiser)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShieldAlert className="mx-auto size-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Organiser access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in as {user.email}, but this account isn't an organiser yet. Ask an existing
          organiser to add you on their Team page. (Setting up a brand-new deployment? See "Initial
          organiser setup" in the README.)
        </p>
        <Button asChild className="mt-6">
          <Link to="/events">Browse events</Link>
        </Button>
      </div>
    );
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="no-print mb-8 flex flex-wrap gap-2">
        {[
          { to: "/admin", label: "Overview" },
          { to: "/admin/events/new", label: "Create event" },
          { to: "/admin/registrations", label: "Registrations" },
          { to: "/admin/verify", label: "Verify pass" },
          { to: "/admin/team", label: "Team" },
          { to: "/admin/profile", label: "Profile" },
        ].map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: true }}
            className="rounded-full border px-4 py-2 text-sm font-medium data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
