import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export const upcomingEventsQuery = queryOptions({
  queryKey: ["events", "upcoming"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .gte("event_date", todayIST())
      .order("event_date")
      .order("start_time");
    if (error) throw error;
    return data;
  },
});

export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["events", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const allEventsQuery = queryOptions({
  queryKey: ["events", "all"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const prnRuleQuery = queryOptions({
  queryKey: ["settings", "prn"],
  queryFn: async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["prn_regex", "prn_hint"]);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    return { regex: map["prn_regex"] ?? "^[A-Za-z0-9]{6,16}$", hint: map["prn_hint"] ?? "" };
  },
  staleTime: 5 * 60_000,
});

// Events the signed-in organiser may manage (created, co-organised or unowned).
export const managedEventIdsQuery = queryOptions({
  queryKey: ["events", "managed-ids"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_managed_event_ids");
    if (error) throw error;
    return new Set<string>(data ?? []);
  },
});
