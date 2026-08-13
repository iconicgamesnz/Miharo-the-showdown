import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LobbyPlayer = {
  id: string;
  nickname: string;
  character_id: string | null;
  status: string;
  is_host: boolean;
  score: number;
  joined_at: string;
};

export type LobbyRoom = {
  id: string;
  code: string;
  status: string;
  max_players: number;
};

export type CharacterRow = {
  id: string;
  slug: string;
  name: string;
  personality: string;
  accessory: string;
  accent_color: string;
  sort_order: number;
};

/**
 * Live lobby state shared by the TV display and every phone.
 * One channel per room; torn down on unmount.
 */
export function useRoomChannel(code: string) {
  const [room, setRoom] = useState<LobbyRoom | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    const upper = code.toUpperCase();
    const { data: roomRow } = await supabase
      .from("rooms")
      .select("id, code, status, max_players")
      .eq("code", upper)
      .maybeSingle();

    if (!roomRow) {
      setMissing(true);
      setLoading(false);
      return null;
    }
    setMissing(false);
    setRoom(roomRow);

    const { data: playerRows } = await supabase
      .from("room_players")
      .select("id, nickname, character_id, status, is_host, score, joined_at")
      .eq("room_id", roomRow.id)
      .neq("status", "left")
      .order("joined_at", { ascending: true });
    setPlayers(playerRows ?? []);
    setLoading(false);
    return roomRow.id;
  }, [code]);

  useEffect(() => {
    let active = true;
    supabase
      .from("characters")
      .select("id, slug, name, personality, accessory, accent_color, sort_order")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (active && data) setCharacters(data);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const roomId = await refresh();
      if (!roomId || cancelled) return;
      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
          () => void refresh(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { room, players, characters, loading, missing, refresh };
}
