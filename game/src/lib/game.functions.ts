import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashToken, normalizeCode } from "@/lib/rooms.server";

/**
 * Client-callable gameplay RPCs. Everything authoritative lives in
 * `game.server.ts`, loaded inside the handlers so it never reaches the browser
 * bundle.
 */

export const tickSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().min(3).max(8) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { tick } = await import("@/lib/game.server");
    return tick(supabaseAdmin, normalizeCode(data.code));
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(3).max(8),
        playerToken: z.string().min(10).max(80),
        sessionQuestionId: z.string().uuid(),
        /** Single-tap formats. */
        optionKey: z.string().min(1).max(8).optional(),
        /** Ordering formats — the complete submitted sequence. */
        order: z.array(z.string().min(1).max(8)).min(2).max(8).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAnswer } = await import("@/lib/game.server");
    return recordAnswer(
      supabaseAdmin,
      normalizeCode(data.code),
      await hashToken(data.playerToken),
      data.sessionQuestionId,
      { ...(data.optionKey ? { optionKey: data.optionKey } : {}), ...(data.order ? { order: data.order } : {}) },
    );
  });

/** Round 4: commits a player's risk tier before the question is revealed. */
export const submitRisk = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(3).max(8),
        playerToken: z.string().min(10).max(80),
        riskKey: z.enum(["shell_be_right", "hard_out", "send_it"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordRisk } = await import("@/lib/game.server");
    return recordRisk(
      supabaseAdmin,
      normalizeCode(data.code),
      await hashToken(data.playerToken),
      data.riskKey,
    );
  });

/** Host-only: leaves the Round 1 results screen and starts Round 2. */

export const advanceRound = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ code: z.string().min(3).max(8), hostToken: z.string().min(10).max(80) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { startNextRound } = await import("@/lib/game.server");
    const code = normalizeCode(data.code);
    const { isRoomHost } = await import("@/lib/host-auth.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, host_token_hash, game_pack_id")
      .eq("code", code)
      .maybeSingle();
    if (!room) throw new Error("No room with that code.");
    if (!(await isRoomHost(supabaseAdmin, room.id, room.host_token_hash, data.hostToken)))
      throw new Error("Only the host can move things on.");
    return startNextRound(supabaseAdmin, code, room.game_pack_id);
  });


export const getPlayerSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ code: z.string().min(3).max(8), playerToken: z.string().min(10).max(80) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { playerSnapshot } = await import("@/lib/game.server");
    return playerSnapshot(supabaseAdmin, normalizeCode(data.code), await hashToken(data.playerToken));
  });

/** Host-only: replays the same room with the same players and a fresh session. */
export const playAgain = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ code: z.string().min(3).max(8), hostToken: z.string().min(10).max(80) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { startRematch } = await import("@/lib/game.server");
    const code = normalizeCode(data.code);
    const { isRoomHost } = await import("@/lib/host-auth.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, host_token_hash, game_pack_id")
      .eq("code", code)
      .maybeSingle();
    if (!room) throw new Error("No room with that code.");
    if (!(await isRoomHost(supabaseAdmin, room.id, room.host_token_hash, data.hostToken)))
      throw new Error("Only the host can start a rematch.");
    return startRematch(supabaseAdmin, code, room.game_pack_id);
  });
