import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtDateTime, fmtTime, friendlyError, isUuid, seatsLeft, slugify, toCsv } from "@/lib/events";
import { eventQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/events/$eventId/registrations")({
  component: Registrations,
});

const PAGE_SIZE = 50;
const FETCH_CHUNK = 1000; // the API caps a single response at 1000 rows
type Attendance = "all" | "checked_in" | "not_checked_in" | "cancelled";

async function fetchRegistrations(eventId: string) {
  const all = [];
  for (let from = 0; ; from += FETCH_CHUNK) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id,code,student_name,prn,department,status,registered_at,checked_in_at")
      .eq("event_id", eventId)
      .order("registered_at", { ascending: false })
      .order("id")
      .range(from, from + FETCH_CHUNK - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < FETCH_CHUNK) return all;
  }
}

function Registrations() {
  const { eventId } = Route.useParams();
  const valid = isUuid(eventId);
  const { data: ev, isLoading: evLoading } = useQuery({ ...eventQuery(eventId), enabled: valid });
  const {
    data: regs,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["registrations", eventId],
    enabled: valid,
    queryFn: () => fetchRegistrations(eventId),
  });
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [attendance, setAttendance] = useState<Attendance>("all");
  const [page, setPage] = useState(0);

  const depts = useMemo(() => [...new Set((regs ?? []).map((r) => r.department))].sort(), [regs]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (regs ?? []).filter(
      (r) =>
        (dept === "all" || r.department === dept) &&
        (attendance === "all" ||
          (attendance === "cancelled" && r.status === "cancelled") ||
          (attendance === "checked_in" && r.status === "confirmed" && !!r.checked_in_at) ||
          (attendance === "not_checked_in" && r.status === "confirmed" && !r.checked_in_at)) &&
        (!term || r.student_name.toLowerCase().includes(term) || r.prn.toLowerCase().includes(term)),
    );
  }, [regs, q, dept, attendance]);
  const filtered = !!q.trim() || dept !== "all" || attendance !== "all";
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const checkedIn = (regs ?? []).filter((r) => r.status === "confirmed" && r.checked_in_at).length;

  const update = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };
  const clear = () => {
    setQ("");
    setDept("all");
    setAttendance("all");
    setPage(0);
  };

  function exportCsv() {
    const header = [
      "Registration ID",
      "Student name",
      "PRN",
      "Department",
      "Registered at",
      "Status",
      "Checked in at",
    ];
    const csv = toCsv([
      header,
      ...rows.map((r) => [
        r.code,
        r.student_name,
        r.prn,
        r.department,
        fmtDateTime(r.registered_at),
        r.status,
        r.checked_in_at ? fmtDateTime(r.checked_in_at) : "",
      ]),
    ]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `${slugify(ev?.title ?? "event") || "event"}-${eventId.slice(0, 8)}-registrations${filtered ? "-filtered" : ""}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success(`Exported ${rows.length} registration${rows.length === 1 ? "" : "s"}`);
  }

  if (!valid || (!evLoading && !ev))
    return (
      <div className="rounded-2xl border bg-card p-10 text-center">
        <p className="font-semibold">Event not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin">Back to dashboard</Link>
        </Button>
      </div>
    );

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{ev?.title ?? "Registrations"}</h1>
          {ev && (
            <p className="mt-1 text-muted-foreground">
              {fmtDate(ev.event_date)} · {fmtTime(ev.start_time)} · {ev.venue}{" "}
              {ev.status !== "published" && <Badge variant="secondary">{ev.status}</Badge>}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {ev && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
          {(
            [
              ["Confirmed", ev.confirmed_count],
              ["Capacity", ev.capacity],
              ["Seats left", seatsLeft(ev)],
              ["Checked in", regs ? checkedIn : "…"],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="text-2xl font-extrabold">{v}</p>
              <p className="text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => update(setQ)(e.target.value)}
            placeholder="Search name or PRN"
            className="pl-9"
            aria-label="Search by student name or PRN"
          />
        </div>
        <Select value={dept} onValueChange={update(setDept)}>
          <SelectTrigger className="lg:w-60" aria-label="Filter by department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {depts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={attendance} onValueChange={(v) => update(setAttendance)(v as Attendance)}>
          <SelectTrigger className="lg:w-48" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="checked_in">Checked in</SelectItem>
            <SelectItem value="not_checked_in">Not checked in</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" onClick={clear}>
            <X /> Clear filters
          </Button>
        )}
        <Button onClick={exportCsv} disabled={!rows.length}>
          <Download /> Export CSV
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {regs
          ? `${rows.length} of ${regs.length} registration${regs.length === 1 ? "" : "s"} shown. Export includes ${
              filtered ? "only the filtered" : "all"
            } ${rows.length} row${rows.length === 1 ? "" : "s"}, with PRNs — handle the file as confidential.`
          : " "}
      </p>
      <div className="mt-3 overflow-x-auto rounded-2xl border bg-card shadow-card">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-muted" />
        ) : error ? (
          <div className="p-6 text-destructive">
            Couldn't load registrations: {friendlyError(error)}{" "}
            <Button variant="link" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !rows.length ? (
          <div className="p-10 text-center text-muted-foreground">
            {regs?.length ? (
              <>
                No registrations match these filters.{" "}
                <Button variant="link" onClick={clear}>
                  Clear filters
                </Button>
              </>
            ) : (
              "No registrations yet. Share the event page with students to get started."
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">PRN</th>
                <th className="p-3">Department</th>
                <th className="p-3">Registered</th>
                <th className="p-3">ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.student_name}</td>
                  <td className="p-3 font-mono">{r.prn}</td>
                  <td className="p-3">{r.department}</td>
                  <td className="whitespace-nowrap p-3">{fmtDateTime(r.registered_at)}</td>
                  <td className="p-3 font-mono">{r.code}</td>
                  <td className="p-3">
                    <Badge variant={r.status === "confirmed" ? "default" : "destructive"}>{r.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {r.checked_in_at ? (
                      <span className="font-medium text-success">✓ {fmtDateTime(r.checked_in_at)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {current + 1} of {pages}
          </span>
          <Button size="sm" variant="outline" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
