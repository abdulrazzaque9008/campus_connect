import type { Database } from "@/integrations/supabase/types";
import technical from "@/assets/cat-technical.jpg";
import cultural from "@/assets/cat-cultural.jpg";
import sports from "@/assets/cat-sports.jpg";
import workshop from "@/assets/cat-workshop.jpg";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type RegistrationRow = Database["public"]["Tables"]["registrations"]["Row"];
export type Category = Database["public"]["Enums"]["event_category"];

export const CATEGORIES: Category[] = ["Technical", "Cultural", "Sports", "Workshop"];

export const CATEGORY_INFO: Record<Category, { image: string; blurb: string }> = {
  Technical: { image: technical, blurb: "Hackathons, coding contests and tech talks" },
  Cultural: { image: cultural, blurb: "Music, dance, drama and fests" },
  Sports: { image: sports, blurb: "Tournaments and matches across departments" },
  Workshop: { image: workshop, blurb: "Hands-on sessions to learn new skills" },
};

// Configurable department list for the registration form.
export const DEPARTMENTS = [
  "Information Technology",
  "Computer Science",
  "Computer Science and Engineering",
  "Electronics and Telecommunication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Other",
];

export function coverFor(e: Pick<EventRow, "cover_image_url" | "category">) {
  return e.cover_image_url || CATEGORY_INFO[e.category].image;
}

export function eventStart(e: Pick<EventRow, "event_date" | "start_time">) {
  return new Date(`${e.event_date}T${e.start_time}+05:30`);
}

export type RegState = { open: boolean; label: string; tone: "open" | "full" | "closed" | "cancelled" | "low" };

export function seatsLeft(e: EventRow) {
  return Math.max(0, e.capacity - e.confirmed_count);
}

export function registrationState(e: EventRow, now = new Date()): RegState {
  if (e.status === "cancelled") return { open: false, label: "Cancelled", tone: "cancelled" };
  if (e.status === "completed") return { open: false, label: "Completed", tone: "closed" };
  if (eventStart(e) < now) return { open: false, label: "Event has started or ended", tone: "closed" };
  if (e.registration_deadline && new Date(e.registration_deadline) < now)
    return { open: false, label: "Registration closed", tone: "closed" };
  const left = seatsLeft(e);
  if (left <= 0) return { open: false, label: "Event full", tone: "full" };
  if (left <= Math.max(5, e.capacity * 0.1)) return { open: true, label: `Only ${left} seats left`, tone: "low" };
  return { open: true, label: "Registration open", tone: "open" };
}

export function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export const REGISTER_ERRORS: Record<string, string> = {
  INVALID_NAME: "Please enter your full name (2–100 characters).",
  INVALID_PRN: "That PRN doesn't match the college format.",
  INVALID_DEPARTMENT: "Please choose your department.",
  EVENT_NOT_FOUND: "This event no longer exists.",
  EVENT_CLOSED: "This event is not accepting registrations.",
  EVENT_PAST: "This event has already started — registration is closed.",
  DEADLINE_PASSED: "The registration deadline has passed.",
  DUPLICATE: "This PRN is already registered for this event.",
  EVENT_FULL: "Sorry, this event is full.",
};

export function friendlyError(err: { message?: string } | null | undefined) {
  const msg = err?.message ?? "";
  for (const key of Object.keys(REGISTER_ERRORS)) if (msg.includes(key)) return REGISTER_ERRORS[key] ?? msg;
  if (msg.includes("Capacity cannot be lower")) return msg;
  if (/fetch|network/i.test(msg)) return "Network problem — check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}

// Saved passes on this device (the token itself is the secret).
const PASS_KEY = "campusconnect.passes";
export function savedPassTokens(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PASS_KEY) || "[]");
  } catch {
    return [];
  }
}
export function savePassToken(token: string) {
  const list = savedPassTokens().filter((t) => t !== token);
  localStorage.setItem(PASS_KEY, JSON.stringify([token, ...list]));
}
export function removePassToken(token: string) {
  localStorage.setItem(PASS_KEY, JSON.stringify(savedPassTokens().filter((t) => t !== token)));
}

export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formula-injection guard
  return `"${s.replace(/"/g, '""')}"`;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
