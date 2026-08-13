import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_STATE, type GamePhase, type SessionState } from "@/lib/game-engine/session-state";
import { tickSession } from "@/lib/game.functions";

/**
 * Subscribes to the authoritative session row for a room.
 *
 * Devices never drive state themselves: they poll `tickSession`, and the server
 * decides whether a deadline has actually passed. Realtime pushes the result
 * back to every device at once, with a slow poll as a safety net.
 */
export function useGameSession(code: string, roomId: string | null, drive = false) {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [state, setState] = useState<SessionState>(EMPTY_STATE);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Optimistic lock-in pings, keyed by session question so a new question wipes them.
  const [pulse, setPulse] = useState<{ qid: string; ids: string[] }>({ qid: "", ids: [] });
  // Round 4 risk pings, keyed by the round question index.
  const [riskPulse, setRiskPulse] = useState<{ slot: string; ids: string[] }>({ slot: "", ids: [] });
  const driving = useRef(false);


  const refresh = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from("showdown_game_sessions")
      .select("id, phase, state")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    setSessionId(data.id);
    setPhase((data.phase as GamePhase) ?? "lobby");
    const raw = data.state;
    setState(raw && typeof raw === "object" ? { ...EMPTY_STATE, ...(raw as SessionState) } : EMPTY_STATE);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    void refresh();
    const channel = supabase
      .channel(`session:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showdown_game_sessions", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();
    const poll = window.setInterval(() => void refresh(), 2500);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [roomId, refresh]);

  // Instant lock-in feedback. Phones ping the room the moment a tap is sent, the
  // TV paints it straight away, and the authoritative DB recount still rules —
  // a rejected answer pings back `locked: false` and the recount corrects anyway.
  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`locks:${code}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "locked" }, ({ payload }) => {
        const qid = String(payload?.sessionQuestionId ?? "");
        const playerId = String(payload?.playerId ?? "");
        if (!qid || !playerId) return;
        const on = payload?.locked !== false;
        setPulse((prev) => {
          const ids = prev.qid === qid ? prev.ids : [];
          if (on) {
            if (ids.includes(playerId)) return prev;
            return { qid, ids: [...ids, playerId] };
          }
          if (!ids.includes(playerId)) return { qid, ids };
          return { qid, ids: ids.filter((id) => id !== playerId) };
        });
        void refresh();
      })
      // Round 4: same instant-counter trick for risk selection. Only the fact
      // that a player has committed travels — never which risk they picked.
      .on("broadcast", { event: "risk" }, ({ payload }) => {
        const slot = String(payload?.slot ?? "");
        const playerId = String(payload?.playerId ?? "");
        if (!slot || !playerId) return;
        const on = payload?.locked !== false;
        setRiskPulse((prev) => {
          const ids = prev.slot === slot ? prev.ids : [];
          if (on) {
            if (ids.includes(playerId)) return prev;
            return { slot, ids: [...ids, playerId] };
          }
          return { slot, ids: ids.filter((id) => id !== playerId) };
        });
        void refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, refresh]);




  // Deadline driver. Any device may call; the server is the referee.
  useEffect(() => {
    if (!drive || !roomId) return;
    const id = window.setInterval(async () => {
      if (driving.current) return;
      driving.current = true;
      try {
        await tickSession({ data: { code } });
      } catch {
        /* transient — next tick retries */
      } finally {
        driving.current = false;
      }
    }, 700);
    return () => window.clearInterval(id);
  }, [drive, roomId, code]);

  const currentQid = state.question?.sessionQuestionId ?? "";
  const pendingLockIds = pulse.qid && pulse.qid === currentQid ? pulse.ids : EMPTY_IDS;
  const riskSlot = `${state.round}:${state.index}`;
  const pendingRiskIds = riskPulse.slot === riskSlot ? riskPulse.ids : EMPTY_IDS;

  return { phase, state, sessionId, refresh, pendingLockIds, pendingRiskIds };
}


const EMPTY_IDS: string[] = [];

/** Joins the broadcast channel ahead of time so the first lock-in is instant. */
export function prewarmLocks(code: string) {
  if (code) void lockChannel(code);
}

/** Announces a server-accepted lock-in to every device in the room. */
const lockChannels = new Map<string, Promise<ReturnType<typeof supabase.channel>>>();

/** One joined broadcast channel per room, reused for the life of the tab. */
function lockChannel(code: string) {
  let joined = lockChannels.get(code);
  if (!joined) {
    joined = new Promise((resolve) => {
      const channel = supabase.channel(`locks:${code}`, { config: { broadcast: { self: false } } });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve(channel);
      });
      window.setTimeout(() => resolve(channel), 4000); // send anyway; worst case it's a no-op
    });
    lockChannels.set(code, joined);
  }
  return joined;
}

/** Pings every device in the room that a player has (or hasn't) locked in. */
export async function announceLock(
  code: string,
  sessionQuestionId: string,
  playerId: string,
  locked = true,
) {
  try {
    const channel = await lockChannel(code);
    await channel.send({
      type: "broadcast",
      event: "locked",
      payload: { sessionQuestionId, playerId, locked },
    });
  } catch {
    /* purely cosmetic — the DB recount is authoritative */
  }
}

/**
 * Round 4: pings that a player has committed to a risk. The chosen tier is
 * deliberately NOT broadcast — only the fact that they're in.
 */
export async function announceRisk(code: string, slot: string, playerId: string, locked = true) {
  try {
    const channel = await lockChannel(code);
    await channel.send({
      type: "broadcast",
      event: "risk",
      payload: { slot, playerId, locked },
    });
  } catch {
    /* purely cosmetic — the DB recount is authoritative */
  }
}






/** Ticking clock that re-renders roughly 10x a second while a deadline runs. */
export function useCountdown(iso: string | undefined) {
  const [ms, setMs] = useState(() => (iso ? Math.max(0, new Date(iso).getTime() - Date.now()) : 0));
  useEffect(() => {
    if (!iso) {
      setMs(0);
      return;
    }
    const target = new Date(iso).getTime();
    const update = () => setMs(Math.max(0, target - Date.now()));
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [iso]);
  return ms;
}
