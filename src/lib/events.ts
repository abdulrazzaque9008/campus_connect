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

// Messages for the codes raised by the database guards (see drizzle/migrations).
export const ADMIN_ERRORS: Record<string, string> = {
  EVENT_LOCKED: "Cancelled or completed events can't be changed.",
  EVENT_IN_PAST: "The event must start in the future.",
  DEADLINE_AFTER_START: "The registration deadline must be before the event starts.",
  DEADLINE_REQUIRED: "A registration deadline is required.",
  DEADLINE_IN_PAST: "The registration deadline must be in the future.",
  INVALID_DESCRIPTION: "The description must be 10–5000 characters.",
  INVALID_VENUE: "The venue must be 2–150 characters.",
  INVALID_SHORT_DESCRIPTION: "The short description can be at most 200 characters.",
  INVALID_CONTACT: "Contact details can be at most 200 characters.",
  INVALID_IMAGE_URL: "The image URL must start with http:// or https://.",
  EVENT_HAS_REGISTRATIONS: "This event has registrations, so it can't be deleted. Cancel it instead.",
  REGISTRATION_FINAL: "A cancelled registration can't be re-confirmed.",
  FORBIDDEN: "You don't have organiser access for this action.",
  USER_NOT_FOUND: "No account with that email. Ask them to create an account on the login page first.",
  EMAIL_NOT_CONFIRMED: "That account hasn't confirmed its email address yet.",
  CANNOT_REVOKE_SELF: "You can't remove your own organiser access.",
};

export function friendlyError(err: { message?: string } | null | undefined) {
  const msg = err?.message ?? "";
  const known = { ...REGISTER_ERRORS, ...ADMIN_ERRORS };
  for (const key of Object.keys(known)) if (msg.includes(key)) return known[key] ?? msg;
  if (msg.includes("Capacity cannot be lower")) return msg;
  if (/row-level security|permission denied/i.test(msg)) return ADMIN_ERRORS["FORBIDDEN"]!;
  if (/fetch|network/i.test(msg)) return "Network problem — check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}

/** Public base URL encoded in QR passes. Set VITE_PUBLIC_SITE_URL so passes
 * issued from a preview URL still point at the deployed site. */
export function siteOrigin() {
  const configured = (import.meta.env["VITE_PUBLIC_SITE_URL"] as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function verifyUrl(token: string) {
  return `${siteOrigin()}/verify/${token}`;
}

export function passUrl(token: string) {
  return `${siteOrigin()}/pass/${token}`;
}

const TOKEN_RE = /^[a-f0-9]{32,128}$/i;

/** Accepts a raw token or any pass / verification link (current or legacy
 * `/admin/verify?token=` format) and returns the token, or null. */
export function parsePassToken(input: string): string | null {
  const v = input.trim();
  if (TOKEN_RE.test(v)) return v.toLowerCase();
  const m = v.match(/(?:[?&]token=|\/verify\/|\/pass\/)([a-f0-9]{32,128})(?![a-f0-9])/i);
  return m?.[1] ? m[1].toLowerCase() : null;
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Saved passes on this device (the token itself is the secret).
const PASS_KEY = "campusconnect.passes";
export function savedPassTokens(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(PASS_KEY) || "[]");
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string" && TOKEN_RE.test(t)) : [];
  } catch {
    return [];
  }
}
function writePassTokens(list: string[]) {
  try {
    localStorage.setItem(PASS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // private mode / storage full: the pass link still works
  }
}
export function savePassToken(token: string) {
  return writePassTokens([token, ...savedPassTokens().filter((t) => t !== token)]);
}
export function removePassToken(token: string) {
  writePassTokens(savedPassTokens().filter((t) => t !== token));
}

export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formula-injection guard
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]) {
  // BOM so Excel opens UTF-8 names correctly
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
