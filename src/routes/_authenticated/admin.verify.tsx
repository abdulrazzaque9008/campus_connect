import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parsePassToken } from "@/lib/events";

// Legacy `/admin/verify?token=…` links are redirected to /verify/$token in
// the parent `_authenticated` route, before the sign-in check.
export const Route = createFileRoute("/_authenticated/admin/verify")({
  component: Verify,
});

function Verify() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = parsePassToken(input);
    if (!token) {
      setError("That doesn't look like a CampusConnect pass link. Paste the full link from the QR code.");
      return;
    }
    setError("");
    setInput("");
    navigate({ to: "/verify/$token", params: { token } });
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-extrabold">Verify entry pass</h1>
      <div className="mt-6 rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex gap-3">
          <Camera className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-semibold">At the entrance</p>
            <p className="mt-1 text-muted-foreground">
              Point your phone's camera (or any QR scanner app) at the student's pass and open the link. Stay signed in
              on this phone's browser and you'll get a <strong>Check in</strong> button on the verification page.
              Each pass can only be checked in once.
            </p>
          </div>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-2" noValidate>
        <Label htmlFor="pass-link">Or paste a pass link</Label>
        <div className="flex gap-2">
          <Input
            id="pass-link"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://…/verify/…"
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "pass-link-error" : undefined}
            autoComplete="off"
          />
          <Button type="submit" disabled={!input.trim()}>
            <ScanLine /> Check
          </Button>
        </div>
        {error && (
          <p id="pass-link-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
