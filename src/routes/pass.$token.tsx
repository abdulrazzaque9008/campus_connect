import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EntryPass } from "@/components/entry-pass";
import { supabase } from "@/integrations/supabase/client";
import { passUrl, savePassToken } from "@/lib/events";

export const Route = createFileRoute("/pass/$token")({
  head: () => ({
    meta: [
      { title: "Your Entry Pass – CampusConnect" },
      { name: "description", content: "Your QR entry pass for a JNEC club event." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your Entry Pass – CampusConnect" },
      { property: "og:description", content: "Your QR entry pass for a JNEC club event." },
    ],
  }),
  component: PassPage,
});

function PassPage() {
  const { token } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["pass", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pass", { _token: token });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const [stored, setStored] = useState(true);
  useEffect(() => {
    if (data) setStored(savePassToken(token));
  }, [data, token]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(passUrl(token));
      toast.success("Pass link copied — keep it somewhere safe (e.g. send it to yourself).");
    } catch {
      toast.error(
        "Couldn't copy automatically. Copy the address from your browser's address bar instead.",
      );
    }
  }

  function download() {
    const canvas = document.querySelector<HTMLCanvasElement>("#pass canvas");
    if (!canvas || !data) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${data.registration_code}-entry-qr.png`;
    a.click();
  }

  if (isLoading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Pass not found</h1>
        <p className="mt-2 text-muted-foreground">This link is invalid or has expired.</p>
        <Button asChild className="mt-6">
          <Link to="/events">Browse events</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="no-print mb-6">
        <h1 className="text-2xl font-extrabold">You're in! 🎉</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save this page — it's your entry pass. It's also kept under "My Passes" on this device.
          Anyone with this link can show your pass, so don't post it publicly.
        </p>
        {!stored && (
          <p className="mt-3 rounded-lg bg-warning/20 px-3 py-2 text-sm">
            This browser isn't allowing CampusConnect to save passes (private mode?). Copy the pass
            link or download the QR so you don't lose it.
          </p>
        )}
      </div>
      <EntryPass pass={data} token={token} id="pass" />
      <div className="no-print mt-6 flex flex-wrap gap-3">
        <Button onClick={() => window.print()}>
          <Printer /> Print pass
        </Button>
        <Button variant="outline" onClick={download}>
          <Download /> Download QR
        </Button>
        <Button variant="outline" onClick={copyLink}>
          <Copy /> Copy pass link
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/my-passes">My passes</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/events/$eventId" params={{ eventId: data.event_id }}>
            Event details
          </Link>
        </Button>
      </div>
    </div>
  );
}
