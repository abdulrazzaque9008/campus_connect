import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { csvCell, fmtDate, fmtDateTime, seatsLeft, slugify } from "@/lib/events";
import { eventQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/events/$eventId/registrations")({
  component: Registrations,
});

function Registrations() {
  const { eventId } = Route.useParams();
  const { data: ev } = useQuery(eventQuery(eventId));
  const { data: regs, isLoading, error } = useQuery({
    queryKey: ["registrations", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id,code,student_name,prn,department,status,registered_at")
        .eq("event_id", eventId)
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");

  const depts = useMemo(() => [...new Set((regs ?? []).map((r) => r.department))].sort(), [regs]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (regs ?? []).filter(
      (r) =>
        (dept === "all" || r.department === dept) &&
        (!term || r.student_name.toLowerCase().includes(term) || r.prn.toLowerCase().includes(term)),
    );
  }, [regs, q, dept]);

  function exportCsv() {
    const header = ["Registration ID", "Student name", "PRN", "Department", "Registration date", "Status"];
    const lines = [header, ...rows.map((r) => [r.code, r.student_name, r.prn, r.department, fmtDateTime(r.registered_at), r.status])]
      .map((l) => l.map(csvCell).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + lines], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slugify(ev?.title ?? "event")}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold">{ev?.title ?? "Registrations"}</h1>
      {ev && <p className="mt-1 text-muted-foreground">{fmtDate(ev.event_date)} · {ev.venue}</p>}
      {ev && (
        <div className="mt-6 grid grid-cols-3 gap-4 sm:max-w-xl">
          {[["Confirmed", ev.confirmed_count], ["Capacity", ev.capacity], ["Seats left", seatsLeft(ev)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="text-2xl font-extrabold">{v}</p>
              <p className="text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or PRN" className="pl-9" />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="md:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={exportCsv} disabled={!rows.length}><Download /> Export CSV</Button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card shadow-card">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-muted" />
        ) : error ? (
          <p className="p-6 text-destructive">Couldn't load registrations.</p>
        ) : !rows.length ? (
          <p className="p-10 text-center text-muted-foreground">{regs?.length ? "No registrations match." : "No registrations yet."}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr><th className="p-3">Name</th><th className="p-3">PRN</th><th className="p-3">Department</th><th className="p-3">Registered</th><th className="p-3">ID</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.student_name}</td>
                  <td className="p-3 font-mono">{r.prn}</td>
                  <td className="p-3">{r.department}</td>
                  <td className="whitespace-nowrap p-3">{fmtDateTime(r.registered_at)}</td>
                  <td className="p-3 font-mono">{r.code}</td>
                  <td className="p-3"><Badge variant={r.status === "confirmed" ? "default" : "destructive"}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{rows.length} shown</p>
    </div>
  );
}
