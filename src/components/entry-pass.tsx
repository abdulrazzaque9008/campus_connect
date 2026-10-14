import { QRCodeCanvas } from "qrcode.react";
import { CalendarHeart } from "lucide-react";
import { fmtDate, fmtDateTime, fmtTime, verifyUrl } from "@/lib/events";

export type PassData = {
  registration_code: string;
  student_name: string;
  department: string;
  status: "confirmed" | "cancelled";
  event_title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  club_name: string;
  event_status: "published" | "cancelled" | "completed";
  checked_in_at?: string | null;
};

export function EntryPass({ pass, token, id }: { pass: PassData; token: string; id?: string }) {
  const invalid = pass.status !== "confirmed" || pass.event_status === "cancelled";
  return (
    <div id={id} className="overflow-hidden rounded-3xl border bg-card shadow-lift">
      <div className="flex items-center justify-between bg-primary px-6 py-4 text-primary-foreground">
        <span className="flex items-center gap-2 font-bold">
          <CalendarHeart className="size-5" /> CampusConnect
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest">Entry pass</span>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {pass.club_name}
            </p>
            <h2 className="text-2xl font-extrabold leading-tight">{pass.event_title}</h2>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-semibold">{fmtDate(pass.event_date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time</dt>
              <dd className="font-semibold">
                {fmtTime(pass.start_time)} – {fmtTime(pass.end_time)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="font-semibold">{pass.venue}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Attendee</dt>
              <dd className="font-semibold">{pass.student_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Registration ID</dt>
              <dd className="font-mono font-semibold">{pass.registration_code}</dd>
            </div>
          </dl>
          {!invalid && pass.checked_in_at && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
              Checked in {fmtDateTime(pass.checked_in_at)}
            </p>
          )}
          {invalid && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {pass.event_status === "cancelled"
                ? "This event has been cancelled."
                : "This registration was cancelled."}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4">
          <QRCodeCanvas value={verifyUrl(token)} size={168} level="M" />
          <p className="text-xs text-muted-foreground">Show at entry</p>
        </div>
      </div>
    </div>
  );
}
