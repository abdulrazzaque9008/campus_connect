import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarClock, Ticket, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { eventStart, fmtDate, friendlyError, type EventRow } from "@/lib/events";
import { allEventsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Overview() {
  const qc = useQueryClient();
  const { data: events, isLoading } = useQuery(allEventsQuery);
  const { data: depts } = useQuery({
    queryKey: ["admin", "dept-breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase.from("registrations").select("department").eq("status", "confirmed");
      if (error) throw error;
      const m: Record<string, number> = {};
      data.forEach((r) => (m[r.department] = (m[r.department] ?? 0) + 1));
      return Object.entries(m).map(([name, value]) => ({ name, value }));
    },
  });

  async function setStatus(e: EventRow, status: "cancelled" | "completed") {
    const { error } = await supabase.from("events").update({ status }).eq("id", e.id);
    if (error) return toast.error(friendlyError(error));
    toast.success(status === "cancelled" ? "Event cancelled" : "Marked as completed");
    qc.invalidateQueries({ queryKey: ["events"] });
  }

  if (isLoading || !events) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  const now = new Date();
  const upcoming = events.filter((e) => e.status === "published" && eventStart(e) > now);
  const stats = [
    { label: "Total events", value: events.length, icon: CalendarCheck },
    { label: "Upcoming events", value: upcoming.length, icon: CalendarClock },
    { label: "Confirmed registrations", value: events.reduce((s, e) => s + e.confirmed_count, 0), icon: Users },
    { label: "Events full", value: events.filter((e) => e.confirmed_count >= e.capacity).length, icon: Ticket },
  ];
  const chart = events
    .filter((e) => e.status !== "cancelled")
    .slice(0, 10)
    .map((e) => ({ name: e.title.length > 18 ? e.title.slice(0, 17) + "…" : e.title, Registered: e.confirmed_count, Capacity: e.capacity }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold">Dashboard</h1>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-5 shadow-card">
              <s.icon className="size-5 text-accent" />
              <p className="mt-3 text-3xl font-extrabold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-bold">Capacity vs confirmed registrations</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Capacity" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Registered" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-bold">Registrations by department</h2>
          {depts && depts.length ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={depts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {depts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-muted-foreground">No registrations yet.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Manage events</h2>
          <Button asChild><Link to="/admin/events/new">Create event</Link></Button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="p-3">Event</th><th className="p-3">Date</th><th className="p-3">Seats</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.club_name}{e.is_sample && " · sample"}</p>
                  </td>
                  <td className="whitespace-nowrap p-3">{fmtDate(e.event_date)}</td>
                  <td className="whitespace-nowrap p-3">{e.confirmed_count}/{e.capacity}</td>
                  <td className="p-3">
                    <Badge variant={e.status === "cancelled" ? "destructive" : e.status === "completed" ? "secondary" : "default"}>{e.status}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button asChild size="sm" variant="ghost"><Link to="/events/$eventId" params={{ eventId: e.id }}>View</Link></Button>
                      <Button asChild size="sm" variant="ghost"><Link to="/admin/events/$eventId/edit" params={{ eventId: e.id }}>Edit</Link></Button>
                      <Button asChild size="sm" variant="outline"><Link to="/admin/events/$eventId/registrations" params={{ eventId: e.id }}>Registrations</Link></Button>
                      {e.status === "published" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setStatus(e, "completed")}>Complete</Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive">Cancel</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel "{e.title}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Registration will close and existing entry passes will be rejected at the door. Registrations are kept for your records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep event</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setStatus(e, "cancelled")}>
                                  Cancel event
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
