import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { fmtDate, fmtDateTime, fmtTime, friendlyError, parsePassToken } from "@/lib/events";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verify/$token")({
  head: () => ({
    meta: [
      { title: "Verify Entry Pass – CampusConnect" },
      { name: "description", content: "Entry pass verification for CampusConnect events." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: VerifyPass,
});

type Result = "valid" | "checked_in" | "event_cancelled" | "registration_cancelled" | "event_completed" | "invalid";

const RESULT_UI: Record<Result, { title: string; detail: string; tone: "ok" | "warn" | "bad" }> = {
  valid: { title: "Valid Pass", detail: "This entry pass is genuine and has not been used yet.", tone: "ok" },
  checked_in: { title: "Already Checked In", detail: "This pass has already been used for entry.", tone: "warn" },
  event_cancelled: { title: "Invalid Pass", detail: "This event has been cancelled.", tone: "bad" },
  registration_cancelled: { title: "Invalid Pass", detail: "This registration was cancelled.", tone: "bad" },
  event_completed: { title: "Event Ended", detail: "This event is over — the pass can no longer be used.", tone: "bad" },
  invalid: { title: "Invalid Pass", detail: "This pass could not be verified. It may be mistyped or fake.", tone: "bad" },
};

function VerifyPass() {
  const { token: raw } = Route.useParams();
  const token = parsePassToken(raw);
  const { user, ready } = useSession();
  const qc = useQueryClient();
  const queryKey = ["verify", token, user?.id ?? "anon"];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    enabled: ready && !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verify_pass", { _token: token! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("check_in_pass", { _token: token! });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (r) => {
      if (r?.result === "checked_in") toast.success(`Checked in ${r.student_name ?? ""}`.trim());
      else if (r?.result === "already_checked_in")
        toast.warning(`Already checked in${r.checked_in_at ? ` at ${fmtDateTime(r.checked_in_at)}` : ""}`);
      else toast.error("This pass can't be checked in.");
      qc.invalidateQueries({ queryKey: ["verify", token] });
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["admin", "attendance"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (token && (!ready || isLoading))
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-10 animate-spin text-accent" aria-label="Verifying pass" />
      </div>
    );

  if (error)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto size-12 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">Couldn't verify right now</h1>
        <p className="mt-2 text-sm text-muted-foreground">{friendlyError(error)}</p>
        <Button className="mt-6" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );

  const result: Result = (data?.result as Result | undefined) ?? "invalid";
  const ui = RESULT_UI[result] ?? RESULT_UI.invalid;
  const staff = !!data?.is_staff;
  const Icon = ui.tone === "ok" ? CheckCircle2 : ui.tone === "warn" ? AlertTriangle : XCircle;
  const known = result !== "invalid" && !!data?.event_title;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <div
        role="status"
        className={cn(
          "rounded-3xl border-2 p-6 text-center",
          ui.tone === "ok" && "border-success/50 bg-success/10",
          ui.tone === "warn" && "border-warning/60 bg-warning/15",
          ui.tone === "bad" && "border-destructive/50 bg-destructive/10",
        )}
      >
        <Icon
          className={cn(
            "mx-auto size-16",
            ui.tone === "ok" && "text-success",
            ui.tone === "warn" && "text-warning-foreground",
            ui.tone === "bad" && "text-destructive",
          )}
        />
        <h1 className="mt-3 text-3xl font-extrabold">{ui.title}</h1>
        <p className="mt-1 text-sm text-foreground/80">{ui.detail}</p>
        {result === "checked_in" && data?.checked_in_at && (
          <p className="mt-2 font-semibold">Checked in {fmtDateTime(data.checked_in_at)}</p>
        )}
      </div>

      {known && data && (
        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border bg-card p-6 text-sm shadow-card">
          <div className="col-span-2">
            <dt className="text-muted-foreground">Event</dt>
            <dd className="text-lg font-bold">{data.event_title}</dd>
          </div>
          {data.event_date && (
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-semibold">{fmtDate(data.event_date)}</dd>
            </div>
          )}
          {data.start_time && data.end_time && (
            <div>
              <dt className="text-muted-foreground">Time</dt>
              <dd className="font-semibold">
                {fmtTime(data.start_time)} – {fmtTime(data.end_time)}
              </dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground">Venue</dt>
            <dd className="font-semibold">{data.venue}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Attendee</dt>
            <dd className="font-semibold">{data.student_name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Attendance</dt>
            <dd className="font-semibold">{data.checked_in_at ? "Checked in" : "Not checked in"}</dd>
          </div>
          {staff && (
            <>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-semibold">{data.department}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registration ID</dt>
                <dd className="font-mono font-semibold">{data.registration_code}</dd>
              </div>
            </>
          )}
        </dl>
      )}

      <div className="mt-6 space-y-3">
        {staff ? (
          <>
            {result === "valid" && (
              <Button
                size="lg"
                className="h-14 w-full text-lg"
                onClick={() => checkIn.mutate()}
                disabled={checkIn.isPending}
              >
                {checkIn.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Check in attendee
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/verify">
                <ScanLine /> Verify another pass
              </Link>
            </Button>
          </>
        ) : (
          known && (
            <p className="rounded-xl bg-secondary px-4 py-3 text-center text-sm">
              {user ? (
                "This account doesn't have organiser access, so it can't check passes in."
              ) : (
                <>
                  Event staff?{" "}
                  <Link
                    to="/auth"
                    search={{ redirect: `/verify/${token}` }}
                    className="font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to see full details and check this attendee in.
                </>
              )}
            </p>
          )
        )}
      </div>
    </div>
  );
}
