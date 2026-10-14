import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Calendar, Clock, Loader2, Mail, MapPin, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/event-card";
import { supabase } from "@/integrations/supabase/client";
import {
  DEPARTMENTS,
  coverFor,
  fmtDate,
  fmtDateTime,
  fmtTime,
  friendlyError,
  isUuid,
  registrationState,
  savePassToken,
  seatsLeft,
  type EventRow,
} from "@/lib/events";
import { eventQuery, prnRuleQuery } from "@/lib/queries";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event details – CampusConnect" },
      { name: "description", content: "Event details, seat availability and registration on CampusConnect." },
      { property: "og:title", content: "Event details – CampusConnect" },
      { property: "og:description", content: "Event details, seat availability and registration on CampusConnect." },
    ],
  }),
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const valid = isUuid(eventId);
  // Poll so the seat counter stays current while students are deciding.
  const { data: ev, isLoading, error } = useQuery({ ...eventQuery(eventId), enabled: valid, refetchInterval: 15_000 });
  const [open, setOpen] = useState(false);

  if (valid && isLoading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  if (error || !ev)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{error ? "Couldn't load this event" : "Event not found"}</h1>
        <Button asChild className="mt-6"><Link to="/events">Back to events</Link></Button>
      </div>
    );

  const state = registrationState(ev);
  const left = seatsLeft(ev);
  const pct = Math.min(100, (ev.confirmed_count / ev.capacity) * 100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> All events
      </Link>
      <div className="mt-4 overflow-hidden rounded-3xl">
        <img src={coverFor(ev)} alt="" className="aspect-[21/9] w-full object-cover" width={1280} height={720} />
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ev.category}</Badge>
            {ev.is_sample && <Badge variant="outline">Sample event</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{ev.title}</h1>
          <p className="mt-2 font-semibold text-accent">by {ev.club_name}</p>
          {ev.short_description && <p className="mt-4 text-lg font-medium text-foreground/90">{ev.short_description}</p>}
          <p className="mt-6 whitespace-pre-line leading-relaxed text-foreground/85">{ev.description}</p>
        </div>
        <aside className="h-fit rounded-2xl border bg-card p-6 shadow-card lg:sticky lg:top-24">
          <StatusPill state={state} />
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex gap-3"><Calendar className="size-4 text-accent" /> {fmtDate(ev.event_date)}</li>
            <li className="flex gap-3"><Clock className="size-4 text-accent" /> {fmtTime(ev.start_time)} – {fmtTime(ev.end_time)}</li>
            <li className="flex gap-3"><MapPin className="size-4 text-accent" /> {ev.venue}</li>
            {ev.registration_deadline && (
              <li className="flex gap-3"><Timer className="size-4 text-accent" /> Register by {fmtDateTime(ev.registration_deadline)}</li>
            )}
            {ev.contact_info && (
              <li className="flex gap-3"><Mail className="size-4 shrink-0 text-accent" /> <span className="break-words">{ev.contact_info}</span></li>
            )}
          </ul>
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium"><Users className="size-4" /> {ev.confirmed_count} registered</span>
              <span className="text-muted-foreground">{ev.capacity} max</span>
            </div>
            <Progress value={pct} className="mt-2" />
            <p className="mt-2 text-sm font-semibold">{left} seats remaining</p>
          </div>
          <Button className="mt-6 w-full" size="lg" disabled={!state.open} onClick={() => setOpen(true)}>
            {state.open ? "Register now" : state.label}
          </Button>
        </aside>
      </div>
      <RegisterDialog ev={ev} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function RegisterDialog({ ev, open, onOpenChange }: { ev: EventRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: rule } = useQuery(prnRuleQuery);
  const [name, setName] = useState("");
  const [prn, setPrn] = useState("");
  const [dept, setDept] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, " ");
    const p = prn.trim().toUpperCase();
    const errs: Record<string, string> = {};
    if (n.length < 2) errs["name"] = "Please enter your full name.";
    if (n.length > 100) errs["name"] = "Name is too long.";
    if (!p) errs["prn"] = "PRN is required.";
    else if (rule && !new RegExp(rule.regex).test(p)) errs["prn"] = `Invalid PRN format. ${rule.hint}`;
    if (!dept) errs["dept"] = "Please choose your department.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    const { data, error } = await supabase.rpc("register_for_event", {
      _event_id: ev.id,
      _name: n,
      _prn: p,
      _department: dept,
    });
    setSubmitting(false);
    qc.invalidateQueries({ queryKey: ["events"] });
    if (error || !data?.[0]) {
      toast.error(friendlyError(error));
      return;
    }
    savePassToken(data[0].token);
    toast.success("You're registered! Here's your entry pass.");
    onOpenChange(false);
    navigate({ to: "/pass/$token", params: { token: data[0].token } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register for {ev.title}</DialogTitle>
          <DialogDescription>Only three details needed. You'll get a QR entry pass right away.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" />
            {errors["name"] && <p className="text-sm text-destructive">{errors["name"]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prn">PRN</Label>
            <Input id="prn" value={prn} onChange={(e) => setPrn(e.target.value)} maxLength={20} placeholder={rule?.hint} />
            {errors["prn"] && <p className="text-sm text-destructive">{errors["prn"]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue placeholder="Select your department" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors["dept"] && <p className="text-sm text-destructive">{errors["dept"]}</p>}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />} Confirm registration
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
