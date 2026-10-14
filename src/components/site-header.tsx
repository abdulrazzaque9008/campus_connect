import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/events", label: "Explore Events" },
  { to: "/categories", label: "Categories" },
  { to: "/my-passes", label: "My Passes" },
  { to: "/admin", label: "Admin Dashboard" },
] as const;

export function SiteHeader() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarHeart className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-primary">
            Campus<span className="text-accent">Connect</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary data-[status=active]:bg-secondary data-[status=active]:text-primary"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:block">
          {user ? (
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut /> Log out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth" search={{ redirect: undefined }}>
                Organiser login
              </Link>
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <div className="border-t px-4 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: n.to === "/" }}
              className="block rounded-lg px-3 py-2 text-sm font-medium data-[status=active]:bg-secondary"
            >
              {n.label}
            </Link>
          ))}
          <div className="mt-2 px-3">
            {user ? (
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut /> Log out
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth" search={{ redirect: undefined }} onClick={() => setOpen(false)}>
                  Organiser login
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mt-20 border-t bg-secondary/50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="font-bold text-primary">CampusConnect – A Club Event Hub</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            One place for every club event at Jawaharlal Nehru Engineering College.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/events" className="hover:text-primary">
            Explore events
          </Link>
          <Link to="/categories" className="hover:text-primary">
            Categories
          </Link>
          <Link to="/my-passes" className="hover:text-primary">
            My passes
          </Link>
          <Link to="/admin" className="hover:text-primary">
            Organisers
          </Link>
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CampusConnect · JNEC
      </p>
    </footer>
  );
}
