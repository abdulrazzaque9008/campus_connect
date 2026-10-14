import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { parsePassToken } from "@/lib/events";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Passes issued before /verify existed encode /admin/verify?token=…. Send
    // them to the public verification page instead of the login screen.
    if (location.pathname === "/admin/verify") {
      const token = parsePassToken(location.href);
      if (token) throw redirect({ to: "/verify/$token", params: { token }, replace: true });
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
