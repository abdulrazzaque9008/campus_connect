import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/admin/verify")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s["token"] === "string" ? s["token"] : undefined,
  }),
  component: Verify,
});

function Verify() {
  const { token } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/verify" });
  const [input, setInput] = useState("");
  const { data, isFetching, error } = useQuery({
    queryKey: ["verify", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verify_pass", { _token: token! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = input.trim();
    const m = v.match(/token=([a-f0-9]+)/i);
    navigate({ search: { token: m?.[1] ?? v } });
    setInput("");
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-extrabold">Verify entry pass</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan the QR code with your phone's camera — it opens this page and checks the pass automatically. You can also paste the scanned link here.
      </p>
      <form onSubmit={submit} className="mt-6 flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste pass link or token" />
        <Button type="submit" disabled={!input.trim()}>Check</Button>
      </form>
      <div className="mt-6">
        {isFetching ? (
          <Loader2 className="size-8 animate-spin text-accent" />
        ) : error ? (
          <p className="text-destructive">Couldn't verify — try again.</p>
        ) : data ? (
          <div className={`rounded-2xl border p-6 ${data.valid ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
            <div className="flex items-center gap-3">
              {data.valid ? <CheckCircle2 className="size-8 text-success" /> : <XCircle className="size-8 text-destructive" />}
              <p className="text-xl font-bold">{data.reason}</p>
            </div>
            {data.registration_code && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Name</dt><dd className="font-semibold">{data.student_name}</dd></div>
                <div><dt className="text-muted-foreground">Department</dt><dd className="font-semibold">{data.department}</dd></div>
                <div><dt className="text-muted-foreground">Event</dt><dd className="font-semibold">{data.event_title}</dd></div>
                <div><dt className="text-muted-foreground">Date</dt><dd className="font-semibold">{data.event_date && fmtDate(data.event_date)}</dd></div>
                <div><dt className="text-muted-foreground">Registration ID</dt><dd className="font-mono font-semibold">{data.registration_code}</dd></div>
              </dl>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
