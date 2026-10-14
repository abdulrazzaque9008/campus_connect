import { afterEach, describe, expect, it, vi } from "vitest";
import {
  csvCell,
  friendlyError,
  parsePassToken,
  toCsv,
  verifyUrl,
  type EventRow,
} from "@/lib/events";
import {
  initialValues,
  toIstInput,
  validateEventForm,
  type EventFormValues,
} from "@/lib/event-validation";

const TOKEN = "a".repeat(16) + "0123456789abcdef0123456789abcdef";

describe("CSV export", () => {
  it("quotes and escapes commas, quotes and newlines", () => {
    expect(csvCell('Patil, "Raj"\nIT')).toBe('"Patil, ""Raj""\nIT"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it("neutralises spreadsheet formulas", () => {
    for (const evil of ['=HYPERLINK("http://x")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])
      expect(csvCell(evil).startsWith("\"'")).toBe(true);
    expect(csvCell("Priya")).toBe('"Priya"');
  });

  it("builds a UTF-8 CSV with CRLF rows", () => {
    const csv = toCsv([
      ["Name", "Dept"],
      ["Zoë", "IT"],
    ]);
    expect(csv).toBe('﻿"Name","Dept"\r\n"Zoë","IT"');
  });
});

describe("parsePassToken", () => {
  it("accepts raw tokens and every link format", () => {
    expect(parsePassToken(TOKEN)).toBe(TOKEN);
    expect(parsePassToken(` ${TOKEN.toUpperCase()} `)).toBe(TOKEN);
    expect(parsePassToken(`https://campus.example/verify/${TOKEN}`)).toBe(TOKEN);
    expect(parsePassToken(`https://campus.example/pass/${TOKEN}?x=1`)).toBe(TOKEN);
    expect(parsePassToken(`https://campus.example/admin/verify?token=${TOKEN}`)).toBe(TOKEN);
    expect(parsePassToken(`/admin/verify?token=${TOKEN}&a=b`)).toBe(TOKEN);
  });

  it("rejects junk, short and non-hex input", () => {
    expect(parsePassToken("")).toBeNull();
    expect(parsePassToken("2023IT1045")).toBeNull();
    expect(parsePassToken("abc123")).toBeNull();
    expect(parsePassToken(`https://campus.example/verify/${"z".repeat(48)}`)).toBeNull();
  });
});

describe("verifyUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the configured public site URL", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://campusconnect.example.edu/");
    expect(verifyUrl(TOKEN)).toBe(`https://campusconnect.example.edu/verify/${TOKEN}`);
  });

  it("falls back to the current origin", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
    expect(verifyUrl(TOKEN)).toBe(`${window.location.origin}/verify/${TOKEN}`);
  });

  it("never contains anything but the opaque token", () => {
    expect(verifyUrl(TOKEN)).not.toMatch(/prn|name/i);
  });
});

describe("friendlyError", () => {
  it("maps database guard codes to readable messages", () => {
    expect(friendlyError({ message: "EVENT_FULL" })).toMatch(/full/);
    expect(friendlyError({ message: "DEADLINE_AFTER_START" })).toMatch(/before the event starts/);
    expect(friendlyError({ message: "EVENT_LOCKED" })).toMatch(/can't be changed/);
    expect(
      friendlyError({ message: 'new row violates row-level security policy for table "events"' }),
    ).toMatch(/organiser access/);
  });
});

describe("validateEventForm", () => {
  const now = new Date("2026-10-14T12:00:00+05:30");
  const good: EventFormValues = {
    title: "Robotics Expo",
    club_name: "Robotics Club",
    short_description: "",
    description: "Build and race line-following robots.",
    category: "Technical",
    event_date: "2026-11-20",
    start_time: "10:00",
    end_time: "16:00",
    venue: "Main Hall",
    capacity: "100",
    registration_deadline: "2026-11-19T23:59",
    cover_image_url: "",
    contact_info: "",
  };
  const v = (patch: Partial<EventFormValues>, initial?: EventRow) =>
    validateEventForm({ ...good, ...patch }, initial, now);

  it("accepts a valid event", () => {
    expect(v({})).toEqual({});
  });

  it("requires every mandatory field", () => {
    const err = validateEventForm(initialValues(), undefined, now);
    expect(Object.keys(err).sort()).toEqual(
      [
        "capacity",
        "category",
        "club_name",
        "description",
        "end_time",
        "event_date",
        "registration_deadline",
        "start_time",
        "title",
        "venue",
      ].sort(),
    );
  });

  it("rejects inconsistent times and dates", () => {
    expect(v({ end_time: "09:00" }).end_time).toBeDefined();
    expect(v({ end_time: "10:00" }).end_time).toBeDefined();
    expect(
      v({ event_date: "2026-10-01", registration_deadline: "2026-09-30T10:00" }).event_date,
    ).toMatch(/future/);
    expect(v({ registration_deadline: "2026-11-20T10:01" }).registration_deadline).toMatch(
      /before the event/,
    );
    expect(v({ registration_deadline: "2026-11-20T10:00" }).registration_deadline).toBeUndefined();
    expect(v({ registration_deadline: "2026-10-01T10:00" }).registration_deadline).toMatch(
      /future/,
    );
  });

  it("rejects invalid capacities", () => {
    for (const capacity of ["0", "-5", "1.5", "abc", "", "100001"])
      expect(v({ capacity }).capacity).toBeDefined();
    expect(v({ capacity: "100000" }).capacity).toBeUndefined();
  });

  it("validates optional fields", () => {
    expect(v({ cover_image_url: "javascript:alert(1)" }).cover_image_url).toBeDefined();
    expect(
      v({ cover_image_url: "https://img.example/banner.jpg" }).cover_image_url,
    ).toBeUndefined();
    expect(v({ short_description: "x".repeat(201) }).short_description).toBeDefined();
  });

  describe("editing", () => {
    const existing = {
      id: "6f1c1a4e-8a51-4c41-9f5a-6d1f2c3b4a5e",
      title: "Robotics Expo",
      club_name: "Robotics Club",
      short_description: null,
      description: "Build and race line-following robots.",
      category: "Technical",
      event_date: "2026-10-14",
      start_time: "09:00:00",
      end_time: "17:00:00",
      venue: "Main Hall",
      capacity: 50,
      confirmed_count: 30,
      cover_image_url: null,
      contact_info: null,
      registration_deadline: "2026-10-13T18:29:00+00:00",
      status: "published",
      is_sample: false,
      created_by: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    } satisfies EventRow;

    it("loads existing values, including the IST deadline", () => {
      expect(toIstInput(existing.registration_deadline)).toBe("2026-10-13T23:59");
      expect(initialValues(existing).start_time).toBe("09:00");
    });

    it("allows saving an already-started event if the schedule is unchanged", () => {
      expect(validateEventForm(initialValues(existing), existing, now)).toEqual({});
    });

    it("never lets capacity drop below confirmed registrations", () => {
      const f = { ...initialValues(existing), capacity: "29" };
      expect(validateEventForm(f, existing, now).capacity).toMatch(/30 confirmed/);
      expect(validateEventForm({ ...f, capacity: "30" }, existing, now).capacity).toBeUndefined();
    });
  });
});
