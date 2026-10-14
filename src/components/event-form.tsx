import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, CATEGORY_INFO, friendlyError, type Category, type EventRow } from "@/lib/events";
import {
  MAX_CAPACITY,
  initialValues,
  toPayload,
  validateEventForm,
  type EventFormValues,
} from "@/lib/event-validation";
import { supabase } from "@/integrations/supabase/client";

export function EventForm({ initial, onSaved }: { initial?: EventRow; onSaved: (id: string) => void }) {
  const [f, setF] = useState<EventFormValues>(() => initialValues(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormValues, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof EventFormValues) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateEventForm(f, initial);
    setErrors(err);
    const first = Object.keys(err)[0];
    if (first) {
      document.getElementById(first)?.focus();
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const payload = toPayload(f);
    let res;
    setBusy(true);
    if (initial) {
      // Only send what changed, so untouched values never trip server rules.
      const before = toPayload(initialValues(initial));
      const changes = Object.fromEntries(
        Object.entries(payload).filter(([k, v]) => before[k as keyof typeof before] !== v),
      ) as Partial<typeof payload>;
      if (!Object.keys(changes).length) {
        setBusy(false);
        toast.info("No changes to save.");
        return;
      }
      res = await supabase.from("events").update(changes).eq("id", initial.id).select("id").maybeSingle();
      if (!res.error && !res.data) res = { ...res, error: { message: "FORBIDDEN" } };
    } else {
      res = await supabase.from("events").insert(payload).select("id").single();
    }
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(friendlyError(res.error));
      return;
    }
    toast.success(initial ? "Event updated" : "Event created and published");
    onSaved(res.data.id);
  }

  const field = (k: keyof EventFormValues, label: string, el: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {el}
      {errors[k] ? (
        <p id={`${k}-error`} className="text-sm text-destructive">
          {errors[k]}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
  const a11y = (k: keyof EventFormValues) => ({
    "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
  });
  const input = (k: keyof EventFormValues, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={k} value={f[k]} onChange={(e) => set(k)(e.target.value)} {...a11y(k)} {...props} />
  );
  const preview = f.cover_image_url.trim();

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-5 rounded-2xl border bg-card p-6 shadow-card md:grid-cols-2"
    >
      <div className="md:col-span-2">{field("title", "Event title *", input("title", { maxLength: 150 }))}</div>
      {field(
        "club_name",
        "Organising club or department *",
        input("club_name", { maxLength: 100 }),
      )}
      {field(
        "category",
        "Category *",
        <Select value={f.category} onValueChange={(v) => set("category")(v as Category)}>
          <SelectTrigger id="category" {...a11y("category")}>
            <SelectValue placeholder="Choose category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      )}
      <div className="md:col-span-2">
        {field(
          "short_description",
          "Short description",
          input("short_description", { maxLength: 200, placeholder: "One line shown at the top of the event page" }),
          `${f.short_description.trim().length}/200`,
        )}
      </div>
      <div className="md:col-span-2">
        {field(
          "description",
          "Full description *",
          <Textarea
            id="description"
            rows={6}
            maxLength={5000}
            value={f.description}
            onChange={(e) => set("description")(e.target.value)}
            {...a11y("description")}
          />,
        )}
      </div>
      {field("event_date", "Date *", input("event_date", { type: "date" }))}
      {field("venue", "Venue *", input("venue", { maxLength: 150 }))}
      {field("start_time", "Start time (IST) *", input("start_time", { type: "time" }))}
      {field("end_time", "End time (IST) *", input("end_time", { type: "time" }))}
      {field(
        "capacity",
        "Total seat capacity *",
        input("capacity", { type: "number", min: initial?.confirmed_count || 1, max: MAX_CAPACITY, inputMode: "numeric" }),
        initial?.confirmed_count
          ? `${initial.confirmed_count} seats are already taken — capacity can't go below that.`
          : undefined,
      )}
      {field(
        "registration_deadline",
        "Registration deadline (IST) *",
        input("registration_deadline", { type: "datetime-local" }),
        "Must be on or before the event start.",
      )}
      <div className="md:col-span-2">
        {field(
          "contact_info",
          "Contact / organiser details",
          input("contact_info", { maxLength: 200, placeholder: "e.g. Riya Patil, events@college.edu" }),
        )}
      </div>
      <div className="grid gap-4 md:col-span-2 md:grid-cols-[1fr_200px]">
        {field(
          "cover_image_url",
          "Banner image URL",
          input("cover_image_url", { placeholder: "https://…", inputMode: "url" }),
          "Optional — the category image is used otherwise.",
        )}
        <img
          src={preview && /^https?:\/\/\S+$/.test(preview) ? preview : f.category ? CATEGORY_INFO[f.category].image : CATEGORY_INFO.Technical.image}
          alt="Banner preview"
          className="aspect-video w-full rounded-xl border object-cover"
        />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {initial ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
