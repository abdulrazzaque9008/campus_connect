import { CATEGORIES, type Category, type EventRow } from "@/lib/events";

export type EventFormValues = {
  title: string;
  club_name: string;
  short_description: string;
  description: string;
  category: Category | "";
  event_date: string; // yyyy-mm-dd
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  venue: string;
  capacity: string;
  registration_deadline: string; // yyyy-mm-ddTHH:MM, IST
  cover_image_url: string;
  contact_info: string;
};

export const MAX_CAPACITY = 100000;

/** All times are entered and stored as India Standard Time. */
export function istToDate(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00+05:30`);
}

/** ISO timestamp -> value for an IST datetime-local input. */
export function toIstInput(ts: string | null | undefined) {
  if (!ts) return "";
  return new Date(new Date(ts).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);
}

export function initialValues(e?: EventRow): EventFormValues {
  return {
    title: e?.title ?? "",
    club_name: e?.club_name ?? "",
    short_description: e?.short_description ?? "",
    description: e?.description ?? "",
    category: e?.category ?? "",
    event_date: e?.event_date ?? "",
    start_time: e?.start_time?.slice(0, 5) ?? "",
    end_time: e?.end_time?.slice(0, 5) ?? "",
    venue: e?.venue ?? "",
    capacity: e ? String(e.capacity) : "",
    registration_deadline: toIstInput(e?.registration_deadline),
    cover_image_url: e?.cover_image_url ?? "",
    contact_info: e?.contact_info ?? "",
  };
}

/**
 * Mirrors the database guards in drizzle/migrations (which remain the source
 * of truth) so organisers see problems before submitting.
 */
export function validateEventForm(f: EventFormValues, initial?: EventRow, now = new Date()) {
  const err: Partial<Record<keyof EventFormValues, string>> = {};
  const t = (s: string) => s.trim();
  const len = (s: string) => t(s).length;

  if (len(f.title) < 3 || len(f.title) > 150) err.title = "Title must be 3–150 characters.";
  if (len(f.club_name) < 2 || len(f.club_name) > 100)
    err.club_name = "Organising club must be 2–100 characters.";
  if (len(f.short_description) > 200)
    err.short_description = "Keep the short description under 200 characters.";
  if (len(f.description) < 10 || len(f.description) > 5000)
    err.description = "Description must be 10–5000 characters.";
  if (!f.category || !CATEGORIES.includes(f.category)) err.category = "Choose a category.";
  if (len(f.venue) < 2 || len(f.venue) > 150) err.venue = "Venue must be 2–150 characters.";
  if (len(f.contact_info) > 200) err.contact_info = "Keep contact details under 200 characters.";
  if (
    t(f.cover_image_url) &&
    (!/^https?:\/\/\S+$/.test(t(f.cover_image_url)) || len(f.cover_image_url) > 1000)
  )
    err.cover_image_url = "Enter a valid image URL starting with https://.";

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(f.event_date);
  const validStart = /^\d{2}:\d{2}$/.test(f.start_time);
  const validEnd = /^\d{2}:\d{2}$/.test(f.end_time);
  if (!validDate) err.event_date = "Date is required.";
  if (!validStart) err.start_time = "Start time is required.";
  if (!validEnd) err.end_time = "End time is required.";
  else if (validStart && f.end_time <= f.start_time)
    err.end_time = "End time must be after the start time (same day).";

  const starts = validDate && validStart ? istToDate(f.event_date, f.start_time) : null;
  const scheduleChanged =
    !initial ||
    f.event_date !== initial.event_date ||
    f.start_time !== initial.start_time.slice(0, 5);
  if (starts && scheduleChanged && starts < now)
    err.event_date = "The event must start in the future.";

  const cap = Number(f.capacity);
  if (!/^\d+$/.test(f.capacity.trim()) || !Number.isInteger(cap) || cap < 1 || cap > MAX_CAPACITY)
    err.capacity = `Capacity must be a whole number between 1 and ${MAX_CAPACITY}.`;
  else if (initial && cap < initial.confirmed_count)
    err.capacity = `Can't go below the ${initial.confirmed_count} confirmed registrations.`;

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(f.registration_deadline)) {
    err.registration_deadline = "Registration deadline is required.";
  } else {
    const deadline = new Date(`${f.registration_deadline}:00+05:30`);
    const deadlineChanged =
      !initial || f.registration_deadline !== toIstInput(initial.registration_deadline);
    if (starts && deadline > starts)
      err.registration_deadline = "Deadline must be on or before the event start.";
    else if (deadlineChanged && deadline < now)
      err.registration_deadline = "Deadline must be in the future.";
  }

  return err;
}

export function toPayload(f: EventFormValues) {
  const t = (s: string) => s.trim();
  return {
    title: t(f.title),
    club_name: t(f.club_name),
    short_description: t(f.short_description) || null,
    description: t(f.description),
    event_date: f.event_date,
    start_time: f.start_time,
    end_time: f.end_time,
    venue: t(f.venue),
    category: f.category as Category,
    capacity: Number(f.capacity),
    cover_image_url: t(f.cover_image_url) || null,
    contact_info: t(f.contact_info) || null,
    registration_deadline: new Date(`${f.registration_deadline}:00+05:30`).toISOString(),
  };
}
