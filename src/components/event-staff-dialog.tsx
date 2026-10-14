import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/events";

/** Lists and edits who may manage one event (view registrations, check in, edit). */
export function EventStaffDialog({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const key = ["event-staff", eventId];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_event_staff", { _event_id: eventId });
      if (error) throw error;
      return data;
    },
  });
  const done = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["events"] });
  };
  const add = useMutation({
    mutationFn: async (e: string) => {
      const { error } = await supabase.rpc("add_event_staff", { _event_id: eventId, _email: e });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${email.trim()} can now manage this event`);
      setEmail("");
      done();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_event_staff", {
        _event_id: eventId,
        _user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organiser removed from this event");
      done();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users /> Event organisers
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Organisers of {eventTitle}</DialogTitle>
          <DialogDescription>
            These organisers can edit the event, see its registrations and check students in.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        ) : error ? (
          <p className="text-sm text-destructive">{friendlyError(error)}</p>
        ) : !data?.length ? (
          <p className="rounded-xl bg-secondary p-3 text-sm">
            This event has no owner (for example a sample event), so every organiser can manage it.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.map((s) => (
              <li key={s.user_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.full_name || s.email}</p>
                  <p className="truncate text-muted-foreground">{s.email}</p>
                </div>
                {s.is_creator ? (
                  <span className="text-xs font-semibold text-muted-foreground">Creator</span>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${s.email}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(s.user_id)}
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="space-y-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
              toast.error("Enter a valid email address.");
              return;
            }
            add.mutate(email.trim());
          }}
        >
          <Label htmlFor="staff-email">Add an organiser to this event</Label>
          <div className="flex gap-2">
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@college.edu"
              autoComplete="off"
            />
            <Button type="submit" disabled={add.isPending || !email.trim()}>
              {add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            They need an organiser account first (Admin → Team).
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
