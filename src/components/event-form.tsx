import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, friendlyError, type Category, type EventRow } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";

function toLocalInput(ts: string | null) {
  if (!ts) return "";
  const d = new Date(new Date(ts).getTime() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export function EventForm({ initial, onSaved }: { initial?: EventRow; onSaved: (id: string) => void }) {
  const [f, setF] = useState({
    title: initial?.title ?? "",
    club_name: initial?.club_name ?? "",
    description: initial?.description ?? "",
    event_date: initial?.event_date ?? "",
    start_time: initial?.start_time?.slice(0, 5) ?? "",
    end_time: initial?.end_time?.slice(0, 5) ?? "",
    venue: initial?.venue ?? "",
    category: (initial?.category ?? "") as Category | "",
    capacity: initial ? String(initial.capacity) : "",
    cover_image_url: initial?.cover_image_url ?? "",
    registration_deadline: toLocalInput(initial?.registration_deadline ?? null),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    const t = (s: string) => s.trim();
    if (t(f.title).length < 3) err["title"] = "Title must be at least 3 characters.";
    if (t(f.club_name).length < 2) err["club_name"] = "Organising club is required.";
    if (t(f.description).length < 10) err["description"] = "Add a description (10+ characters).";
    if (!f.event_date) err["event_date"] = "Date is required.";
    if (!f.start_time) err["start_time"] = "Start time is required.";
    if (!f.end_time) err["end_time"] = "End time is required.";
    else if (f.start_time && f.end_time <= f.start_time) err["end_time"] = "End time must be after start time.";
    if (t(f.venue).length < 2) err["venue"] = "Venue is required.";
    if (!f.category) err["category"] = "Choose a category.";
    const cap = Number(f.capacity);
    if (!Number.isInteger(cap) || cap < 1) err["capacity"] = "Capacity must be a whole number above 0.";
    else if (initial && cap < initial.confirmed_count)
      err["capacity"] = `Can't go below the ${initial.confirmed_count} confirmed registrations.`;
    if (f.cover_image_url && !/^https?:\/\/\S+$/.test(t(f.cover_image_url))) err["cover_image_url"] = "Enter a valid image URL.";
    if (!f.registration_deadline) err["registration_deadline"] = "Registration deadline is required.";
    else if (f.event_date && f.start_time && f.registration_deadline > `${f.event_date}T${f.start_time}`)
      err["registration_deadline"] = "Deadline must be before the event starts.";
    if (!initial && f.event_date && f.start_time && new Date(`${f.event_date}T${f.start_time}+05:30`) < new Date())
      err["event_date"] = "Event must be in the future.";
    setErrors(err);
    if (Object.keys(err).length) return;

    const payload = {
      title: t(f.title),
      club_name: t(f.club_name),
      description: t(f.description),
      event_date: f.event_date,
      start_time: f.start_time,
      end_time: f.end_time,
      venue: t(f.venue),
      category: f.category as Category,
      capacity: cap,
      cover_image_url: t(f.cover_image_url) || null,
      registration_deadline: new Date(`${f.registration_deadline}:00+05:30`).toISOString(),
    };
    setBusy(true);
    const res = initial
      ? await supabase.from("events").update(payload).eq("id", initial.id).select("id").single()
      : await supabase.from("events").insert(payload).select("id").single();
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(friendlyError(res.error));
      return;
    }
    toast.success(initial ? "Event updated" : "Event created and published");
    onSaved(res.data.id);
  }

  const field = (k: keyof typeof f, label: string, el: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {el}
      {errors[k] && <p className="text-sm text-destructive">{errors[k]}</p>}
    </div>
  );
  const input = (k: keyof typeof f, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={k} value={f[k]} onChange={(e) => set(k)(e.target.value)} {...props} />
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border bg-card p-6 shadow-card md:grid-cols-2">
      <div className="md:col-span-2">{field("title", "Event title", input("title", { maxLength: 150 }))}</div>
      {field("club_name", "Organising club", input("club_name", { maxLength: 100 }))}
      {field(
        "category",
        "Category",
        <Select value={f.category} onValueChange={set("category")}>
          <SelectTrigger id="category"><SelectValue placeholder="Choose category" /></SelectTrigger>
          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>,
      )}
      <div className="md:col-span-2">
        {field("description", "Description", <Textarea id="description" rows={5} value={f.description} onChange={(e) => set("description")(e.target.value)} />)}
      </div>
      {field("event_date", "Date", input("event_date", { type: "date" }))}
      {field("venue", "Venue", input("venue", { maxLength: 150 }))}
      {field("start_time", "Start time", input("start_time", { type: "time" }))}
      {field("end_time", "End time", input("end_time", { type: "time" }))}
      {field("capacity", "Maximum capacity", input("capacity", { type: "number", min: 1 }))}
      {field("registration_deadline", "Registration deadline (IST)", input("registration_deadline", { type: "datetime-local" }))}
      <div className="md:col-span-2">
        {field("cover_image_url", "Cover image URL (optional — a category image is used otherwise)", input("cover_image_url", { placeholder: "https://…" }))}
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {initial ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
