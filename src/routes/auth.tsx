import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Organiser Login – CampusConnect" },
      { name: "description", content: "Sign in to manage club events and registrations." },
      { property: "og:title", content: "Organiser Login – CampusConnect" },
      { property: "og:description", content: "Sign in to manage club events and registrations." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email address.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return toast.error(error.message);
      navigate({ to: redirect ?? "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + "/admin", data: { full_name: name.trim() } },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      setSent(true);
    }
  }

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12">
      <div className="w-full rounded-3xl border bg-card p-8 shadow-card">
        <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-accent"><ShieldCheck /></span>
        <h1 className="mt-4 text-2xl font-extrabold">Organiser access</h1>
        <p className="mt-1 text-sm text-muted-foreground">Students don't need an account — just register on any event page.</p>
        {sent ? (
          <p className="mt-6 rounded-xl bg-success/10 p-4 text-sm">Check your inbox to confirm your email, then sign in here.</p>
        ) : (
          <>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "in" | "up")} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Sign in</TabsTrigger>
                <TabsTrigger value="up">Create account</TabsTrigger>
              </TabsList>
            </Tabs>
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "up" && (
                <div className="space-y-1.5">
                  <Label htmlFor="n">Full name</Label>
                  <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="e">Email</Label>
                <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p">Password</Label>
                <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} {mode === "in" ? "Sign in" : "Create account"}
              </Button>
              {mode === "up" && (
                <p className="text-xs text-muted-foreground">New accounts need organiser access granted by an existing organiser.</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
